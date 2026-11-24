"""
设备数据接口（护花使者 IoT 模块）
=================================
接口一览：
  POST /api/devices/{code}/readings   设备上报一条数据（首次上报自动注册设备）
  GET  /api/devices                   设备列表（含最新读数、是否需要浇水）
  GET  /api/devices/{code}/latest     某设备最新一条数据
  GET  /api/devices/{code}/history    历史数据（?limit=50）
  POST /api/devices/{code}/bind       把设备绑定到用户/花盆

⚠️ 安全设计说明（答辩会被问到）：
  上报接口**不做登录鉴权**，因为 ESP32 是资源受限设备，无法走 OAuth/JWT 流程。
  业界通行做法是用设备级凭据（本项目后续可加 device_token 或 MQTT 双向证书）。
  目前仅在内网使用，正式部署前必须补上设备认证，否则任何人都能伪造数据。
"""
import json as _json
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import List, Optional
from datetime import datetime, timedelta

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.device import Device, SensorReading, DeviceAlert, DRY_THRESHOLD
from app.models.user import User
from app.schemas.device import (
    ReadingCreate, ReadingResponse, DeviceResponse,
    LatestResponse, DeviceBindRequest,
    ThresholdPayload, CalibrationPayload,
    AdminDeviceCreate, AdminDeviceUpdate, AdminDeviceResponse, AdminDeviceListResponse,
    DeviceOverviewResponse, DeviceAlertResponse, DeviceAlertListResponse,
)

router = APIRouter(prefix="/api/devices", tags=["devices"])
# 管理后台"设备管理"模块：设备 CRUD / 阈值 / 标定
admin_router = APIRouter(prefix="/api/admin/devices", tags=["admin-devices"])
# 设备告警：查询与确认
alert_router = APIRouter(prefix="/api/device-alerts", tags=["device-alerts"])

# 在线判定：last_seen 距今 ≤ 60 秒视为在线
ONLINE_WINDOW_SECONDS = 60
# 光照只在白天判定下限（06:00–20:00），夜间不因低于下限告警
DAYLIGHT_START_HOUR = 6
DAYLIGHT_END_HOUR = 20

# 固件手工拼 JSON 可能产生非法裸字面量（如 0.5.0 固件把 null 打成 nul，
# 或传感器异常时输出 nan/inf）。仅在标准解析失败后按"裸 token 位置"
# （前面是 : , [ 、后面是 , } ]）把它们修正为 null，不会误伤引号内的字符串。
_BARE_NULL_TOKEN = re.compile(
    r'((?<=[:,\[])\s*)-?(?:nul|nan|inf|none|NaN|Infinity)(?=\s*[,}\]])',
    re.IGNORECASE,
)


def get_current_admin_user(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.post("/{code}/readings", response_model=ReadingResponse, status_code=201)
async def post_reading(code: str, request: Request, db: Session = Depends(get_db)):
    """
    设备上报数据（ESP32 每 10 秒一次，首次上报自动建档）。

    固件手工拼 JSON：传感器读数失败时会把 NaN/Infinity 直接写进报文
    （如 "soil_moisture":nan），属于非法 JSON，标准解析会 422。
    这里改用宽容解析：NaN/Infinity 一律转 null，坏行不丢整条数据。
    """
    raw = await request.body()
    text = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else raw
    data = None
    try:
        data = _json.loads(text, parse_constant=lambda _c: None)
    except Exception:
        # 第一次解析失败：修正非法裸字面量（nul/nan/inf/none）后重试
        try:
            data = _json.loads(
                _BARE_NULL_TOKEN.sub(r"\1null", text),
                parse_constant=lambda _c: None,
            )
        except Exception:
            pass
    if data is None:
        logging.getLogger(__name__).warning(
            "设备 %s 上报报文解析失败（前 300 字节）：%r", code, raw[:300]
        )
        raise HTTPException(status_code=400, detail="无效的 JSON 报文")
    if not isinstance(data, dict):
        raise HTTPException(status_code=400, detail="JSON 报文必须是对象")
    payload = ReadingCreate(**data)

    now = datetime.utcnow()

    device = db.query(Device).filter(Device.code == code).first()
    if device is None:
        device = Device(code=code, name=f"设备 {code}", last_seen=now, created_at=now)
        db.add(device)
    else:
        device.last_seen = now

    # 顺带更新设备的固件版本和 IP（设备每次上报都会带上）
    if payload.firmware:
        device.firmware = payload.firmware
    if payload.ip_address:
        device.ip_address = payload.ip_address

    reading = SensorReading(
        device_code=code,
        soil_moisture=payload.soil_moisture,
        soil_temp=payload.soil_temp,
        air_temp=payload.air_temp,
        air_humidity=payload.air_humidity,
        light_lux=payload.light_lux,
        created_at=now,
    )
    db.add(reading)
    db.flush()

    # 阈值判定与告警维护：越界生成/刷新告警，回到阈值内自动关闭；
    # 同一设备同一指标只保留一条未确认告警（见 _evaluate / _upsert_alert）
    _evaluate(db, device, reading)
    # 设备恢复上报后，自动关闭未确认的离线告警
    _clear_alert_online(db, device)

    db.commit()
    db.refresh(reading)
    return reading


@router.get("", response_model=List[DeviceResponse])
def list_devices(db: Session = Depends(get_db)):
    """设备列表：每台设备附带最新读数和"是否需要浇水"判断"""
    devices = db.query(Device).all()
    result = []
    for d in devices:
        latest = (db.query(SensorReading)
                  .filter(SensorReading.device_code == d.code)
                  .order_by(desc(SensorReading.created_at))
                  .first())
        result.append(DeviceResponse(
            code=d.code,
            name=d.name or "",
            plant_name=d.plant_name or "",
            location=d.location or "",
            firmware=d.firmware or "",
            ip_address=d.ip_address or "",
            last_seen=d.last_seen,
            latest=ReadingResponse.model_validate(latest) if latest else None,
            need_water=(latest.soil_moisture is not None
                        and latest.soil_moisture < DRY_THRESHOLD),
            dry_threshold=DRY_THRESHOLD,
        ))
    return result


@router.get("/{code}/latest", response_model=LatestResponse)
def get_latest(code: str, db: Session = Depends(get_db)):
    """某设备的最新一条数据（App 端首页展示用这个）"""
    r = (db.query(SensorReading)
         .filter(SensorReading.device_code == code)
         .order_by(desc(SensorReading.created_at))
         .first())
    if not r:
        raise HTTPException(status_code=404, detail="该设备还没有上报过数据")

    return LatestResponse(
        device_code=r.device_code,
        soil_moisture=r.soil_moisture,
        soil_temp=r.soil_temp,
        air_temp=r.air_temp,
        air_humidity=r.air_humidity,
        light_lux=r.light_lux,
        created_at=r.created_at,
        need_water=(r.soil_moisture is not None and r.soil_moisture < DRY_THRESHOLD),
        dry_threshold=DRY_THRESHOLD,
    )


@router.get("/{code}/history", response_model=List[ReadingResponse])
def get_history(code: str, limit: int = Query(50, ge=1, le=500),
                db: Session = Depends(get_db)):
    """历史数据，用于画趋势曲线（App 端图表用）"""
    return (db.query(SensorReading)
            .filter(SensorReading.device_code == code)
            .order_by(desc(SensorReading.created_at))
            .limit(limit)
            .all())


@router.post("/{code}/bind")
def bind_device(code: str, payload: DeviceBindRequest, db: Session = Depends(get_db)):
    """把设备绑定到某个用户和某盆花（App 端"添加设备"时调用）"""
    device = db.query(Device).filter(Device.code == code).first()
    if device is None:
        raise HTTPException(status_code=404, detail="设备不存在，请先让设备上电上报一次")
    if payload.user_id is not None:
        device.user_id = payload.user_id
    if payload.plant_name is not None:
        device.plant_name = payload.plant_name
    if payload.location is not None:
        device.location = payload.location
    if payload.name is not None:
        device.name = payload.name
    db.commit()
    return {"message": "绑定成功", "code": device.code, "plant_name": device.plant_name}


@router.get("/mobile", response_class=HTMLResponse, include_in_schema=False)
def mobile_monitor():
    """
    移动端实时监控页（手机浏览器直接打开即可，无需安装 App）
    用途：开发调试阶段快速验证"设备 → 后台 → 手机"链路是否通畅；
          也方便现场答辩时临时用手机演示。
    访问：http://<电脑IP>:8000/api/devices/mobile
    """
    return HTMLResponse(content="""<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<title>护花使者 · 实时监测</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;
     background:#f5f7f5;color:#222;padding:16px;line-height:1.6}
h1{font-size:19px;margin-bottom:4px}
.sub{font-size:12px;color:#888;margin-bottom:16px}
.card{background:#fff;border-radius:14px;padding:18px;margin-bottom:14px;
      box-shadow:0 1px 4px rgba(0,0,0,.07)}
.row{display:flex;justify-content:space-between;align-items:center;
     padding:9px 0;border-bottom:1px solid #f0f0f0}
.row:last-child{border-bottom:none}
.k{color:#666;font-size:14px}
.v{font-size:19px;font-weight:600}
.alert{background:#fff3f0;border-left:4px solid #e5484d;border-radius:8px;
       padding:12px 14px;margin-top:12px;color:#c1272d;font-size:14px}
.ok{background:#eefaf1;border-left:4px solid #30a46c;border-radius:8px;
    padding:12px 14px;margin-top:12px;color:#18794e;font-size:14px}
.empty{text-align:center;color:#999;padding:30px 0;font-size:14px}
.tip{font-size:12px;color:#999;text-align:center;margin-top:18px}
</style>
</head>
<body>
<h1>护花使者 · 实时监测</h1>
<div class="sub" id="time">加载中...</div>
<div id="list"><div class="empty">正在读取设备数据...</div></div>
<div class="tip">页面每 5 秒自动刷新</div>
<script>
async function load(){
  try{
    const r = await fetch('/api/devices');
    const data = await r.json();
    const now = new Date().toLocaleTimeString('zh-CN');
    document.getElementById('time').textContent = '更新于 ' + now;
    if(!data.length){
      document.getElementById('list').innerHTML =
        '<div class="empty">还没有设备上报数据<br>请确认 ESP32 已上电并联网</div>';
      return;
    }
    document.getElementById('list').innerHTML = data.map(d=>{
      const l = d.latest;
      const rows = [];
      if(l){
        if(l.soil_moisture!=null) rows.push(row('土壤湿度', l.soil_moisture.toFixed(1)+' %'));
        if(l.soil_temp!=null)     rows.push(row('土壤温度', l.soil_temp.toFixed(1)+' ℃'));
        if(l.air_temp!=null)      rows.push(row('空气温度', l.air_temp.toFixed(1)+' ℃'));
        if(l.air_humidity!=null)  rows.push(row('空气湿度', l.air_humidity.toFixed(1)+' %'));
        if(l.light_lux!=null)     rows.push(row('光照强度', l.light_lux.toFixed(0)+' lux'));
      } else {
        rows.push('<div class="empty">暂无读数</div>');
      }
      const warn = d.need_water
        ? '<div class="alert">土壤湿度 ' + (l?l.soil_moisture.toFixed(1):'-') +
          '% 低于阈值 ' + d.dry_threshold + '%，该浇水了！</div>'
        : '<div class="ok">水分充足，无需浇水</div>';
      return '<div class="card">' +
        '<div class="row"><span class="k">'+esc(d.name)+'</span>'+
        '<span class="k" style="font-size:12px">'+esc(d.code)+'</span></div>' +
        (d.plant_name ? '<div class="row"><span class="k">植物</span><span>'+esc(d.plant_name)+'</span></div>' : '') +
        rows.join('') +
        '<div class="row"><span class="k">最后上报</span><span style="font-size:12px">'+
        (l?new Date(l.created_at).toLocaleString('zh-CN'):'-')+'</span></div>' +
        warn + '</div>';
    }).join('');
  }catch(e){
    document.getElementById('list').innerHTML =
      '<div class="empty">读取失败：'+esc(String(e))+'</div>';
  }
}
function row(k,v){
  return '<div class="row"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>';
}
function esc(s){
  return String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
load();
setInterval(load,5000);
</script>
</body>
</html>""")


# ══════════════════════════════════════════════════════════════════════════
# 管理后台"设备管理"模块（移植自阈值告警/标定方案）
# ── 阈值口径与前端一致：湿度、土温越界即告警；光照只在 06:00–20:00 判定下限；
# ── 同一设备同一指标只保留一条未确认告警，重复越界只刷新读数与时间。
# ══════════════════════════════════════════════════════════════════════════

# ── 序列化 ────────────────────────────────────────────────────────────────

def _thresholds(device: Device) -> ThresholdPayload:
    return ThresholdPayload(
        moistureMin=device.moisture_min if device.moisture_min is not None else 35,
        moistureMax=device.moisture_max if device.moisture_max is not None else 70,
        tempMin=device.temp_min if device.temp_min is not None else 12,
        tempMax=device.temp_max if device.temp_max is not None else 30,
        airTempMin=device.air_temp_min if device.air_temp_min is not None else 5,
        airTempMax=device.air_temp_max if device.air_temp_max is not None else 35,
        airHumidityMin=device.air_humidity_min if device.air_humidity_min is not None else 20,
        airHumidityMax=device.air_humidity_max if device.air_humidity_max is not None else 90,
        luxMin=device.lux_min if device.lux_min is not None else 500,
        luxMax=device.lux_max if device.lux_max is not None else 30000,
        alarm=bool(device.alarm_enabled),
    )


def _calibration(device: Device) -> CalibrationPayload:
    return CalibrationPayload(
        airRaw=device.air_raw if device.air_raw is not None else 3200,
        waterRaw=device.water_raw if device.water_raw is not None else 1300,
        source=device.calibration_source,
    )


def _reading(device: Device, row: SensorReading) -> ReadingResponse:
    return ReadingResponse(
        id=row.id,
        device_code=device.code,
        soil_moisture=row.soil_moisture,
        soil_temp=row.soil_temp,
        air_temp=row.air_temp,
        air_humidity=row.air_humidity,
        light_lux=row.light_lux,
        created_at=row.created_at,
    )


def _is_online(device: Device, now: datetime) -> bool:
    return bool(device.last_seen) and (now - device.last_seen).total_seconds() <= ONLINE_WINDOW_SECONDS


def _admin_device(device: Device, latest: SensorReading = None) -> AdminDeviceResponse:
    return AdminDeviceResponse(
        id=device.id,
        code=device.code,
        name=device.name or "",
        plant_name=device.plant_name or None,
        location=device.location or None,
        firmware=device.firmware or None,
        ip_address=device.ip_address or None,
        report_interval=device.report_interval or 10,
        enabled=bool(device.enabled),
        online=_is_online(device, datetime.utcnow()),
        last_seen=device.last_seen,
        created_at=device.created_at,
        updated_at=device.updated_at,
        thresholds=_thresholds(device),
        calibration=_calibration(device),
        latest_reading=_reading(device, latest) if latest else None,
    )


def _alert(device: Optional[Device], row: DeviceAlert) -> DeviceAlertResponse:
    return DeviceAlertResponse(
        id=row.id,
        device_id=row.device_id,
        device_code=device.code if device else "",
        device_name=device.name if device else None,
        metric=row.metric,
        label=row.label,
        value=row.value,
        threshold=row.threshold,
        direction=row.direction,
        level=row.level or "warn",
        hint=row.hint,
        acknowledged=bool(row.acknowledged),
        acknowledged_at=row.acknowledged_at,
        created_at=row.created_at,
    )


# ── 判定 ──────────────────────────────────────────────────────────────────

def _is_daylight(moment: Optional[datetime] = None) -> bool:
    """读数时间按服务器本地时区换算后再判断 06:00–20:00。

    数据库里的 created_at 用 UTC 存储，直接取 .hour 会错时区。
    """
    moment = moment or datetime.utcnow()
    offset = datetime.now() - datetime.utcnow()
    hour = (moment + offset).hour
    return DAYLIGHT_START_HOUR <= hour < DAYLIGHT_END_HOUR


def _upsert_alert(
    db: Session,
    device: Device,
    metric: str,
    label: str,
    value: Optional[float],
    threshold: Optional[float],
    direction: str,
    level: str,
    hint: str,
) -> None:
    """同一设备同一指标只留一条未确认记录，避免周期上报刷屏。"""
    existing = (
        db.query(DeviceAlert)
        .filter(
            DeviceAlert.device_id == device.id,
            DeviceAlert.metric == metric,
            DeviceAlert.acknowledged.is_(False),
        )
        .first()
    )
    if existing:
        existing.value = value
        existing.threshold = threshold
        existing.direction = direction
        existing.level = level
        existing.hint = hint
        existing.created_at = datetime.utcnow()
        return

    db.add(DeviceAlert(
        device_id=device.id,
        metric=metric,
        label=label,
        value=value,
        threshold=threshold,
        direction=direction,
        level=level,
        hint=hint,
    ))


def _clear_alert(db: Session, device: Device, metric: str) -> None:
    """读数回到阈值内时，自动关闭该指标的未确认告警。"""
    rows = (
        db.query(DeviceAlert)
        .filter(
            DeviceAlert.device_id == device.id,
            DeviceAlert.metric == metric,
            DeviceAlert.acknowledged.is_(False),
        )
        .all()
    )
    for row in rows:
        row.acknowledged = True
        row.acknowledged_at = datetime.utcnow()


def _clear_alert_online(db: Session, device: Device) -> None:
    rows = (
        db.query(DeviceAlert)
        .filter(
            DeviceAlert.device_id == device.id,
            DeviceAlert.metric == "online",
            DeviceAlert.acknowledged.is_(False),
        )
        .all()
    )
    for row in rows:
        row.acknowledged = True
        row.acknowledged_at = datetime.utcnow()


def _evaluate(db: Session, device: Device, reading: SensorReading) -> None:
    if not device.alarm_enabled:
        return

    m = reading.soil_moisture
    if m is not None:
        if m < (device.moisture_min or 0):
            _upsert_alert(db, device, "soil_moisture", "土壤湿度", m, device.moisture_min,
                          "below", "danger", f"低于下限 {device.moisture_min:.0f}%，建议检查浇水")
        elif m > (device.moisture_max or 100):
            _upsert_alert(db, device, "soil_moisture", "土壤湿度", m, device.moisture_max,
                          "above", "warn", f"高于上限 {device.moisture_max:.0f}%，注意积水烂根")
        else:
            _clear_alert(db, device, "soil_moisture")

    t = reading.soil_temp
    if t is not None:
        if t < (device.temp_min or -40):
            _upsert_alert(db, device, "soil_temp", "土壤温度", t, device.temp_min,
                          "below", "warn", f"低于下限 {device.temp_min:.1f}℃")
        elif t > (device.temp_max or 80):
            _upsert_alert(db, device, "soil_temp", "土壤温度", t, device.temp_max,
                          "above", "warn", f"高于上限 {device.temp_max:.1f}℃")
        else:
            _clear_alert(db, device, "soil_temp")

    at = reading.air_temp
    if at is not None:
        if at < (device.air_temp_min if device.air_temp_min is not None else 5):
            _upsert_alert(db, device, "air_temp", "空气温度", at, device.air_temp_min,
                          "below", "warn", f"低于下限 {(device.air_temp_min or 5):.1f}℃，注意寒害，建议移入室内")
        elif at > (device.air_temp_max if device.air_temp_max is not None else 35):
            _upsert_alert(db, device, "air_temp", "空气温度", at, device.air_temp_max,
                          "above", "warn", f"高于上限 {(device.air_temp_max or 35):.1f}℃，注意遮阴通风")
        else:
            _clear_alert(db, device, "air_temp")

    ah = reading.air_humidity
    if ah is not None:
        if ah < (device.air_humidity_min if device.air_humidity_min is not None else 20):
            _upsert_alert(db, device, "air_humidity", "空气湿度", ah, device.air_humidity_min,
                          "below", "warn", f"低于下限 {(device.air_humidity_min or 20):.0f}%，空气干燥，可喷雾加湿")
        elif ah > (device.air_humidity_max if device.air_humidity_max is not None else 90):
            _upsert_alert(db, device, "air_humidity", "空气湿度", ah, device.air_humidity_max,
                          "above", "warn", f"高于上限 {(device.air_humidity_max or 90):.0f}%，湿度过大，注意通风防霉")
        else:
            _clear_alert(db, device, "air_humidity")

    lux = reading.light_lux
    if lux is None:
        _upsert_alert(db, device, "light_lux", "光照传感器", None, device.lux_min,
                      "missing", "warn", "光照传感器未接入或读取失败，固件上报 light_lux 为 null")
    elif _is_daylight(reading.created_at or datetime.now()):
        if lux < (device.lux_min or 0):
            _upsert_alert(db, device, "light_lux", "光照", lux, device.lux_min,
                          "below", "warn", f"白天低于下限 {device.lux_min:.0f} lx")
        elif lux > (device.lux_max or 100000):
            _upsert_alert(db, device, "light_lux", "光照", lux, device.lux_max,
                          "above", "warn", f"高于上限 {device.lux_max:.0f} lx，可能晒伤")
        else:
            _clear_alert(db, device, "light_lux")
    else:
        # 夜间不做光照下限判定，顺手关掉白天遗留的下限告警
        pending = (
            db.query(DeviceAlert)
            .filter(
                DeviceAlert.device_id == device.id,
                DeviceAlert.metric == "light_lux",
                DeviceAlert.direction == "below",
                DeviceAlert.acknowledged.is_(False),
            )
            .all()
        )
        for row in pending:
            row.acknowledged = True
            row.acknowledged_at = datetime.utcnow()


def _sync_offline_alerts(db: Session, devices: List[Device]) -> None:
    """把超过在线窗口没上报的设备补一条离线告警，恢复后自动关闭。"""
    now = datetime.utcnow()
    changed = False
    for device in devices:
        stale = (
            device.last_seen is None
            or (now - device.last_seen).total_seconds() > ONLINE_WINDOW_SECONDS
        )
        if stale:
            _upsert_alert(
                db, device, "online", "设备连接", None, ONLINE_WINDOW_SECONDS,
                "offline", "danger",
                f"超过 {ONLINE_WINDOW_SECONDS} 秒未收到上报，检查供电与 WiFi",
            )
            changed = True
        else:
            pending = (
                db.query(DeviceAlert)
                .filter(
                    DeviceAlert.device_id == device.id,
                    DeviceAlert.metric == "online",
                    DeviceAlert.acknowledged.is_(False),
                )
                .all()
            )
            for row in pending:
                row.acknowledged = True
                row.acknowledged_at = now
                changed = True
    if changed:
        db.commit()


def _apply_thresholds(device: Device, t: ThresholdPayload) -> None:
    if t.moistureMin >= t.moistureMax:
        raise HTTPException(status_code=400, detail="湿度下限必须小于上限")
    if t.tempMin >= t.tempMax:
        raise HTTPException(status_code=400, detail="土温下限必须小于上限")
    if t.airTempMin >= t.airTempMax:
        raise HTTPException(status_code=400, detail="空气温度下限必须小于上限")
    if t.airHumidityMin >= t.airHumidityMax:
        raise HTTPException(status_code=400, detail="空气湿度下限必须小于上限")
    if t.luxMin >= t.luxMax:
        raise HTTPException(status_code=400, detail="光照下限必须小于上限")
    device.moisture_min = t.moistureMin
    device.moisture_max = t.moistureMax
    device.temp_min = t.tempMin
    device.temp_max = t.tempMax
    device.air_temp_min = t.airTempMin
    device.air_temp_max = t.airTempMax
    device.air_humidity_min = t.airHumidityMin
    device.air_humidity_max = t.airHumidityMax
    device.lux_min = t.luxMin
    device.lux_max = t.luxMax
    device.alarm_enabled = t.alarm


def _apply_calibration(device: Device, c: CalibrationPayload) -> None:
    if c.airRaw <= c.waterRaw:
        raise HTTPException(status_code=400, detail="airRaw 应大于 waterRaw（干燥时 ADC 读数更高）")
    device.air_raw = c.airRaw
    device.water_raw = c.waterRaw
    device.calibration_source = c.source or "后台记录"


# ── 设备管理端点 ──────────────────────────────────────────────────────────

@admin_router.get("", response_model=AdminDeviceListResponse)
def admin_list_devices(
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """设备列表：搜索 + 分页，每台设备带最新读数与在线状态。"""
    query = db.query(Device)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Device.code.like(like)) | (Device.name.like(like))
            | (Device.location.like(like)) | (Device.plant_name.like(like))
        )
    total = query.count()
    devices = (
        query.order_by(Device.id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )
    _sync_offline_alerts(db, devices)

    latest_map: dict = {}
    codes = [d.code for d in devices]
    if codes:
        subq = (
            db.query(
                SensorReading.device_code.label("code"),
                func.max(SensorReading.created_at).label("last_at"),
            )
            .filter(SensorReading.device_code.in_(codes))
            .group_by(SensorReading.device_code)
            .subquery()
        )
        rows = (
            db.query(SensorReading)
            .join(subq, (SensorReading.device_code == subq.c.code)
                  & (SensorReading.created_at == subq.c.last_at))
            .all()
        )
        latest_map = {r.device_code: r for r in rows}

    items = [_admin_device(d, latest_map.get(d.code)) for d in devices]
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@admin_router.get("/overview", response_model=DeviceOverviewResponse)
def devices_overview(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """统计：设备总数 / 在线 / 离线 / 未确认告警数。"""
    devices = db.query(Device).all()
    _sync_offline_alerts(db, devices)

    now = datetime.utcnow()
    online = [d for d in devices if _is_online(d, now)]
    unacknowledged = db.query(DeviceAlert).filter(DeviceAlert.acknowledged.is_(False)).count()

    return DeviceOverviewResponse(
        total=len(devices),
        online=len(online),
        offline=len(devices) - len(online),
        unacknowledged_alerts=unacknowledged,
    )


@admin_router.post("", response_model=AdminDeviceResponse, status_code=201)
def admin_create_device(
    payload: AdminDeviceCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    code = payload.code.strip()
    if db.query(Device).filter(Device.code == code).first():
        raise HTTPException(status_code=400, detail="设备编号已存在")

    device = Device(
        code=code,
        name=payload.name or f"设备 {code}",
        location=payload.location or "",
    )
    if payload.thresholds:
        _apply_thresholds(device, payload.thresholds)
    if payload.calibration:
        _apply_calibration(device, payload.calibration)
    db.add(device)
    db.commit()
    db.refresh(device)
    return _admin_device(device)


@admin_router.get("/{code}", response_model=AdminDeviceResponse)
def admin_get_device(
    code: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    device = db.query(Device).filter(Device.code == code).first()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    _sync_offline_alerts(db, [device])
    latest = (
        db.query(SensorReading)
        .filter(SensorReading.device_code == code)
        .order_by(desc(SensorReading.created_at))
        .first()
    )
    return _admin_device(device, latest)


@admin_router.put("/{code}", response_model=AdminDeviceResponse)
def admin_update_device(
    code: str,
    payload: AdminDeviceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """更新名称 / 位置 / 启用状态 / 阈值 / 标定。"""
    device = db.query(Device).filter(Device.code == code).first()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")

    if payload.name is not None:
        device.name = payload.name.strip() or device.name
    if payload.location is not None:
        device.location = payload.location.strip()
    if payload.enabled is not None:
        device.enabled = payload.enabled
    if payload.thresholds:
        _apply_thresholds(device, payload.thresholds)
    if payload.calibration:
        _apply_calibration(device, payload.calibration)

    db.commit()
    db.refresh(device)
    latest = (
        db.query(SensorReading)
        .filter(SensorReading.device_code == code)
        .order_by(desc(SensorReading.created_at))
        .first()
    )
    return _admin_device(device, latest)


@admin_router.get("/{code}/readings", response_model=List[ReadingResponse])
def admin_list_readings(
    code: str,
    hours: int = Query(24, ge=1, le=720),
    limit: int = Query(20, ge=1, le=500),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """历史读数（按时间倒序，查 sensor_readings 表）。"""
    device = db.query(Device).filter(Device.code == code).first()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    since = datetime.utcnow() - timedelta(hours=hours)
    rows = (
        db.query(SensorReading)
        .filter(SensorReading.device_code == code, SensorReading.created_at >= since)
        .order_by(desc(SensorReading.created_at))
        .limit(limit)
        .all()
    )
    return [_reading(device, r) for r in rows]


@admin_router.delete("/{code}", status_code=204)
def admin_delete_device(
    code: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """删除设备（级联清理读数与告警）。"""
    device = db.query(Device).filter(Device.code == code).first()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    db.query(SensorReading).filter(SensorReading.device_code == code).delete(synchronize_session=False)
    db.query(DeviceAlert).filter(DeviceAlert.device_id == device.id).delete(synchronize_session=False)
    db.delete(device)
    db.commit()
    return None


# ── 设备告警端点 ──────────────────────────────────────────────────────────

@alert_router.get("", response_model=DeviceAlertListResponse)
def list_alerts(
    acknowledged: Optional[bool] = None,
    metric: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """告警列表：可按确认状态与指标筛选，join 设备名。"""
    devices = db.query(Device).all()
    _sync_offline_alerts(db, devices)

    query = db.query(DeviceAlert)
    if acknowledged is not None:
        query = query.filter(DeviceAlert.acknowledged.is_(acknowledged))
    if metric:
        query = query.filter(DeviceAlert.metric == metric)
    total = query.count()
    rows = (
        query.order_by(DeviceAlert.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    by_id = {d.id: d for d in devices}
    items = [_alert(by_id[row.device_id], row) for row in rows if row.device_id in by_id]
    return {"total": total, "page": page, "page_size": page_size, "items": items}


@alert_router.post("/{alert_id}/acknowledge", response_model=DeviceAlertResponse)
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    """确认告警（幂等：重复确认只刷新确认时间）。"""
    row = db.query(DeviceAlert).filter(DeviceAlert.id == alert_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="告警不存在")
    row.acknowledged = True
    row.acknowledged_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    device = db.query(Device).filter(Device.id == row.device_id).first()
    return _alert(device, row)
