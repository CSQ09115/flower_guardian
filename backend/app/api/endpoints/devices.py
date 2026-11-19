"""花盆设备接口。

两部分：
1. 固件上报接口 `POST /api/devices/{code}/readings` —— 无需登录，设备首次上报自动建档；
2. 管理后台接口 `/api/admin/devices*` —— 需要 role=admin。

阈值的判定口径与前端保持一致：
- 湿度、土温越界即告警；
- 光照只在 06:00–20:00 判定，夜间不因低于下限告警；
- 同一设备同一指标只保留一条未确认告警，重复越界只刷新读数与时间。
"""

from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.device import Device, DeviceReading, DeviceAlert
from app.schemas.device import (
    DeviceCreate, DeviceUpdate, DeviceResponse, DeviceListResponse,
    DeviceOverview, ReadingCreate, ReadingResponse, AlertResponse,
    ThresholdPayload, CalibrationPayload,
)

# 90 秒没有上报即视为离线（固件 10 秒一次，留出重连余量）
ONLINE_WINDOW_SECONDS = 90
DAYLIGHT_START_HOUR = 6
DAYLIGHT_END_HOUR = 20

device_router = APIRouter(prefix="/api/devices", tags=["devices"])
admin_router = APIRouter(prefix="/api/admin/devices", tags=["admin-devices"])
alert_router = APIRouter(prefix="/api/admin/device-alerts", tags=["admin-device-alerts"])


def get_current_admin_user(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


# ── 序列化 ────────────────────────────────────────────────────────────────

def _thresholds(device: Device) -> ThresholdPayload:
    return ThresholdPayload(
        moistureMin=device.moisture_min if device.moisture_min is not None else 35,
        moistureMax=device.moisture_max if device.moisture_max is not None else 70,
        tempMin=device.temp_min if device.temp_min is not None else 12,
        tempMax=device.temp_max if device.temp_max is not None else 30,
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


def _reading(device: Device, row: DeviceReading) -> ReadingResponse:
    return ReadingResponse(
        id=row.id,
        device_code=device.code,
        soil_moisture=row.soil_moisture,
        soil_temp=row.soil_temp,
        light_lux=row.light_lux,
        firmware=row.firmware,
        ip_address=row.ip_address,
        created_at=row.created_at,
    )


def _device(device: Device, readings: List[DeviceReading] = None, latest: DeviceReading = None) -> DeviceResponse:
    rows = readings or []
    return DeviceResponse(
        id=device.id,
        code=device.code,
        name=device.name,
        location=device.location,
        firmware=device.firmware,
        ip_address=device.ip_address,
        report_interval=device.report_interval or 10,
        enabled=bool(device.enabled),
        last_seen=device.last_seen,
        created_at=device.created_at,
        thresholds=_thresholds(device),
        calibration=_calibration(device),
        readings=[_reading(device, r) for r in rows],
        latest_reading=_reading(device, latest) if latest else (_reading(device, rows[-1]) if rows else None),
    )


def _alert(device: Device, row: DeviceAlert) -> AlertResponse:
    return AlertResponse(
        id=row.id,
        device_code=device.code,
        metric=row.metric,
        label=row.label,
        value=row.value,
        threshold=row.threshold,
        direction=row.direction,
        level=row.level or "warn",
        hint=row.hint,
        acknowledged=bool(row.acknowledged),
        at=row.created_at,
    )


# ── 判定 ──────────────────────────────────────────────────────────────────

def _is_daylight(moment: Optional[datetime] = None) -> bool:
    """读数时间按服务器本地时区换算后再判断 06:00–20:00。

    数据库里的 created_at 用 UTC 存储，直接取 .hour 会错 8 小时。
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
    """同一设备同一指标只留一条未确认记录，避免 10 秒一条刷屏。"""
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


def _evaluate(db: Session, device: Device, reading: DeviceReading) -> None:
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

    lux = reading.light_lux
    if lux is None:
        _upsert_alert(db, device, "light_lux", "光照传感器", None, device.lux_min,
                      "missing", "warn", "BH1750 未接入或读取失败，固件上报 light_lux 为 null")
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
    """把超过 90 秒没上报的设备补一条离线告警，恢复后自动关闭。"""
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


# ── 固件上报 ──────────────────────────────────────────────────────────────

@device_router.post("/{code}/readings", response_model=ReadingResponse, status_code=201)
def create_reading(
    code: str,
    payload: ReadingCreate,
    db: Session = Depends(get_db),
):
    """ESP32 每 10 秒调用一次。设备不存在时自动建档。"""
    code = code.strip()
    if not code:
        raise HTTPException(status_code=400, detail="设备编号不能为空")

    device = db.query(Device).filter(Device.code == code).first()
    if not device:
        device = Device(
            code=code,
            name=payload.name or f"新设备 {code}",
            location=None,
        )
        db.add(device)
        db.flush()

    if payload.firmware:
        device.firmware = payload.firmware
    if payload.ip_address:
        device.ip_address = payload.ip_address
    device.last_seen = datetime.utcnow()

    reading = DeviceReading(
        device_id=device.id,
        soil_moisture=payload.soil_moisture,
        soil_temp=payload.soil_temp,
        light_lux=payload.light_lux,
        firmware=payload.firmware,
        ip_address=payload.ip_address,
        created_at=datetime.utcnow(),
    )
    db.add(reading)
    db.flush()

    _evaluate(db, device, reading)
    _clear_alert_online(db, device)
    db.commit()
    db.refresh(reading)
    return _reading(device, reading)


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


# ── 管理后台 ──────────────────────────────────────────────────────────────

@admin_router.get("", response_model=DeviceListResponse)
def list_devices(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    query = db.query(Device)
    if search:
        like = f"%{search}%"
        query = query.filter(
            (Device.code.like(like)) | (Device.name.like(like)) | (Device.location.like(like))
        )
    devices = query.order_by(Device.id.asc()).all()
    _sync_offline_alerts(db, devices)

    items = []
    for device in devices:
        latest = (
            db.query(DeviceReading)
            .filter(DeviceReading.device_id == device.id)
            .order_by(DeviceReading.created_at.desc())
            .first()
        )
        items.append(_device(device, latest=latest))
    return {"total": len(items), "items": items}


@admin_router.get("/overview", response_model=DeviceOverview)
def devices_overview(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    devices = db.query(Device).all()
    _sync_offline_alerts(db, devices)

    now = datetime.utcnow()
    online = [d for d in devices if d.last_seen and (now - d.last_seen).total_seconds() <= ONLINE_WINDOW_SECONDS]
    online_ids = [d.id for d in online]

    moisture_values = []
    if online_ids:
        subq = (
            db.query(
                DeviceReading.device_id.label("device_id"),
                func.max(DeviceReading.created_at).label("last_at"),
            )
            .filter(DeviceReading.device_id.in_(online_ids))
            .group_by(DeviceReading.device_id)
            .subquery()
        )
        rows = (
            db.query(DeviceReading)
            .join(subq, (DeviceReading.device_id == subq.c.device_id) & (DeviceReading.created_at == subq.c.last_at))
            .all()
        )
        moisture_values = [r.soil_moisture for r in rows if r.soil_moisture is not None]

    alarm_ids = {
        row.device_id
        for row in db.query(DeviceAlert)
        .filter(DeviceAlert.acknowledged.is_(False), DeviceAlert.metric != "online")
        .all()
    }

    return DeviceOverview(
        total=len(devices),
        online=len(online),
        offline=len(devices) - len(online),
        alarm=len([d for d in online if d.id in alarm_ids]),
        avg_moisture=round(sum(moisture_values) / len(moisture_values), 1) if moisture_values else None,
        last_seen=max((d.last_seen for d in devices if d.last_seen), default=None),
    )


@admin_router.post("", response_model=DeviceResponse, status_code=201)
def create_device(
    payload: DeviceCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    code = payload.code.strip()
    if db.query(Device).filter(Device.code == code).first():
        raise HTTPException(status_code=400, detail="设备编号已存在")

    device = Device(code=code, name=payload.name or f"新设备 {code}", location=payload.location)
    if payload.thresholds:
        _apply_thresholds(device, payload.thresholds)
    if payload.calibration:
        _apply_calibration(device, payload.calibration)
    db.add(device)
    db.commit()
    db.refresh(device)
    return _device(device)


@admin_router.get("/{code}", response_model=DeviceResponse)
def get_device(
    code: str,
    hours: int = Query(24, ge=1, le=720),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    device = db.query(Device).filter(Device.code == code).first()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    _sync_offline_alerts(db, [device])
    since = datetime.utcnow() - timedelta(hours=hours)
    rows = (
        db.query(DeviceReading)
        .filter(DeviceReading.device_id == device.id, DeviceReading.created_at >= since)
        .order_by(DeviceReading.created_at.asc())
        .all()
    )
    return _device(device, readings=rows)


@admin_router.put("/{code}", response_model=DeviceResponse)
def update_device(
    code: str,
    payload: DeviceUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    device = db.query(Device).filter(Device.code == code).first()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")

    if payload.name is not None:
        device.name = payload.name.strip() or device.name
    if payload.location is not None:
        device.location = payload.location.strip() or None
    if payload.enabled is not None:
        device.enabled = payload.enabled
    if payload.thresholds:
        _apply_thresholds(device, payload.thresholds)
    if payload.calibration:
        _apply_calibration(device, payload.calibration)

    db.commit()
    db.refresh(device)
    return _device(device)


@admin_router.get("/{code}/readings", response_model=List[ReadingResponse])
def list_readings(
    code: str,
    hours: int = Query(24, ge=1, le=720),
    limit: int = Query(500, ge=1, le=2000),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    device = db.query(Device).filter(Device.code == code).first()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    since = datetime.utcnow() - timedelta(hours=hours)
    rows = (
        db.query(DeviceReading)
        .filter(DeviceReading.device_id == device.id, DeviceReading.created_at >= since)
        .order_by(DeviceReading.created_at.asc())
        .limit(limit)
        .all()
    )
    return [_reading(device, row) for row in rows]


@admin_router.delete("/{code}", status_code=204)
def delete_device(
    code: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    device = db.query(Device).filter(Device.code == code).first()
    if not device:
        raise HTTPException(status_code=404, detail="设备不存在")
    db.delete(device)
    db.commit()
    return None


@alert_router.get("", response_model=List[AlertResponse])
def list_alerts(
    acknowledged: Optional[bool] = None,
    limit: int = Query(200, ge=1, le=1000),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    devices = db.query(Device).all()
    _sync_offline_alerts(db, devices)

    query = db.query(DeviceAlert)
    if acknowledged is not None:
        query = query.filter(DeviceAlert.acknowledged.is_(acknowledged))
    rows = query.order_by(DeviceAlert.created_at.desc()).limit(limit).all()

    by_id = {d.id: d for d in devices}
    return [_alert(by_id[row.device_id], row) for row in rows if row.device_id in by_id]


@alert_router.put("/{alert_id}/ack", response_model=AlertResponse)
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user),
):
    row = db.query(DeviceAlert).filter(DeviceAlert.id == alert_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="告警不存在")
    row.acknowledged = True
    row.acknowledged_at = datetime.utcnow()
    db.commit()
    db.refresh(row)
    device = db.query(Device).filter(Device.id == row.device_id).first()
    return _alert(device, row)


# ── 赋值 ──────────────────────────────────────────────────────────────────

def _apply_thresholds(device: Device, t: ThresholdPayload) -> None:
    if t.moistureMin >= t.moistureMax:
        raise HTTPException(status_code=400, detail="湿度下限必须小于上限")
    if t.tempMin >= t.tempMax:
        raise HTTPException(status_code=400, detail="土温下限必须小于上限")
    if t.luxMin >= t.luxMax:
        raise HTTPException(status_code=400, detail="光照下限必须小于上限")
    device.moisture_min = t.moistureMin
    device.moisture_max = t.moistureMax
    device.temp_min = t.tempMin
    device.temp_max = t.tempMax
    device.lux_min = t.luxMin
    device.lux_max = t.luxMax
    device.alarm_enabled = t.alarm


def _apply_calibration(device: Device, c: CalibrationPayload) -> None:
    if c.airRaw <= c.waterRaw:
        raise HTTPException(status_code=400, detail="airRaw 应大于 waterRaw（干燥时 ADC 读数更高）")
    device.air_raw = c.airRaw
    device.water_raw = c.waterRaw
    device.calibration_source = c.source or "后台记录"
