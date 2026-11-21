"""管理后台联调用的演示数据种子。

用法::

    python -m app.db.seed_demo          # 建表 + 灌入 / 重置演示数据
    python -m app.db.seed_demo --touch  # 只刷新在线设备心跳，不重建数据

脚本可以重复执行。每次执行会：

1. 建表（与 ``app.main`` 启动时一致）；
2. 复用 ``seed_plants`` / ``seed_products`` 灌入 47 种植物、12 个商品；
3. 确保演示管理员账号存在（用户名 ``admin``）；
4. 重置 8 个演示用户与约 21 笔演示订单；
5. 重置 6 台演示设备、24 小时读数与 7 条告警。

所有由本脚本写入的记录都带 ``演示`` 标记（用户名 ``demo01``…、
订单号 ``DEMO`` 前缀、设备名 ``（演示）`` 后缀、告警设备编号），
删除这些记录即可清空演示数据，不会碰真实数据。

注意：设备在线判定窗口是 90 秒。没有真实固件在跑时，种子写入的
“在线”设备 90 秒后会变成离线；联调前执行一次 ``--touch`` 即可。
"""

from __future__ import annotations

import argparse
import math
import random
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session

from app.core.database import SessionLocal, engine
from app.core.security import get_password_hash
from app.db.base import Base

# 让 Base.metadata 拿到全部表定义（与 app.main 的导入列表一致）
from app.models import (  # noqa: F401  (imported for the side effect)
    Address,
    CartItem,
    Device,
    DeviceAlert,
    DeviceReading,
    DiagnosisRecord,
    Diary,
    EmailVerification,
    Order,
    OrderItem,
    Payment,
    Plant,
    Product,
    Reminder,
    User,
    UserPlant,
)

# email-validator rejects reserved TLDs (.local/.test/.example), so the demo
# accounts use `.demo`, which passes EmailStr.
ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@flowerguardian.demo"
ADMIN_PASSWORD = "FlowerAdmin#2026"
DEMO_EMAIL_DOMAIN = "flowerguardian.demo"

DEMO_PASSWORD = "FlowerDemo#2026"
DEMO_USER_TAG = "演示账号 · 仅供后台联调"
DEMO_ORDER_PREFIX = "DEMO"
DEMO_DEVICE_SUFFIX = "（演示）"

# 与 web/src/admin/data/demo.ts 的 USER_SEED 对齐：姓名与注册时间
DEMO_USERS = [
    ("林小满", "demo01", 1),
    ("陈一叶", "demo02", 3),
    ("周雨", "demo03", 5),
    ("何青", "demo04", 6),
    ("苏木", "demo05", 8),
    ("罗晚", "demo06", 10),
    ("郑南", "demo07", 12),
    ("顾北", "demo08", 13),
]

DEMO_ADDRESSES = [
    "上海市徐汇区漕溪北路 88 号 3 栋 502（演示地址）",
    "杭州市西湖区文三路 258 号（演示地址）",
    "南京市鼓楼区中山北路 12 号（演示地址）",
    "广州市天河区体育西路 46 号（演示地址）",
    "成都市武侯区科华北路 62 号（演示地址）",
]

STATUS_POOL = (
    ["completed"] * 5 + ["shipped"] * 2 + ["confirmed", "pending", "pending", "cancelled"]
)

STEP_MIN = 10
POINTS = (24 * 60) // STEP_MIN + 1  # 145 个点，与演示前端一致

DEVICE_SEEDS = [
    {
        "code": "FG-ESP32-001", "name": "客厅 · 绿萝", "location": "客厅南窗",
        "firmware": "0.4.0", "ip": "192.168.43.77", "last_seen_sec": 6,
        "thresholds": (35, 70, 12, 30, 500, 30000),
        "calibration": (3200, 1312, "NVS soil-cal"),
        "base_moisture": 52.0, "water_events": (7.4, 19.2),
        "lux_peak": 8600.0, "temp_base": 23.4,
    },
    {
        "code": "FG-ESP32-002", "name": "书房 · 龟背竹", "location": "书房东侧",
        "firmware": "0.4.0", "ip": "192.168.43.81", "last_seen_sec": 22,
        "thresholds": (40, 75, 14, 30, 800, 26000),
        "calibration": (3200, 1288, "NVS soil-cal"),
        "base_moisture": 61.0, "water_events": (8.2,),
        "lux_peak": 5200.0, "temp_base": 22.8,
    },
    {
        "code": "FG-ESP32-003", "name": "阳台 · 薄荷", "location": "南阳台",
        "firmware": "0.4.0", "ip": "192.168.43.93", "last_seen_sec": 41,
        "thresholds": (45, 80, 15, 32, 3000, 60000),
        "calibration": (3186, 1264, "NVS soil-cal"),
        "base_moisture": 27.0, "water_events": (9.6,),
        "lux_peak": 28400.0, "temp_base": 25.6, "dry": True,
    },
    {
        "code": "FG-ESP32-004", "name": "卧室 · 白掌", "location": "卧室飘窗",
        "firmware": "0.3.2", "ip": "192.168.43.104", "last_seen_sec": 3 * 3600 + 20 * 60,
        "thresholds": (40, 75, 14, 28, 800, 20000),
        "calibration": (3200, 1300, "出厂默认"),
        "base_moisture": 44.0, "water_events": (),
        "lux_peak": 3800.0, "temp_base": 21.9,
    },
    {
        "code": "FG-ESP32-005", "name": "玄关 · 虎尾兰", "location": "入户玄关",
        "firmware": "0.4.0", "ip": "192.168.43.118", "last_seen_sec": 12,
        "thresholds": (15, 45, 10, 30, 200, 20000),
        "calibration": (3214, 1276, "NVS soil-cal"),
        "base_moisture": 22.0, "water_events": (),
        "lux_peak": 0.0, "temp_base": 22.1, "no_light_sensor": True,
    },
    {
        "code": "FG-ESP32-006", "name": "办公室 · 发财树", "location": "办公室茶水间",
        # 演示里原本是 26h48m；这里缩短到 5h12m，让 24 小时曲线仍有数据
        "firmware": "0.3.2", "ip": "192.168.43.126", "last_seen_sec": 5 * 3600 + 12 * 60,
        "thresholds": (30, 65, 12, 30, 500, 18000),
        "calibration": (3200, 1300, "出厂默认"),
        "base_moisture": 33.0, "water_events": (),
        "lux_peak": 2400.0, "temp_base": 20.6,
    },
]

ONLINE_CODES = {"FG-ESP32-001", "FG-ESP32-002", "FG-ESP32-003", "FG-ESP32-005"}


# ── 用户 ──────────────────────────────────────────────────────────────────

def _ensure_admin(db: Session, now: datetime) -> User:
    admin = db.query(User).filter(User.username == ADMIN_USERNAME).first()
    if admin is None:
        admin = User(
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            password_hash=get_password_hash(ADMIN_PASSWORD),
            is_email_verified=True,
            role="admin",
            bio="演示管理员 · 后台联调账号",
            created_at=now - timedelta(days=30),
        )
        db.add(admin)
        db.flush()
        return admin

    admin.email = ADMIN_EMAIL
    admin.password_hash = get_password_hash(ADMIN_PASSWORD)
    admin.is_email_verified = True
    admin.role = "admin"
    return admin


def _upsert_demo_users(db: Session, now: datetime) -> list[User]:
    users: list[User] = []
    for index, (display_name, username, days_ago) in enumerate(DEMO_USERS):
        user = db.query(User).filter(User.username == username).first()
        created_at = now - timedelta(days=days_ago, hours=index + 2)
        if user is None:
            user = User(
                username=username,
                email=f"{username}@{DEMO_EMAIL_DOMAIN}",
                password_hash=get_password_hash(DEMO_PASSWORD),
                is_email_verified=True,
                role="user",
                bio=f"{display_name} · {DEMO_USER_TAG}",
                created_at=created_at,
            )
            db.add(user)
            db.flush()
        else:
            user.email = f"{username}@{DEMO_EMAIL_DOMAIN}"
            user.is_email_verified = True
            user.role = "user"
            user.bio = f"{display_name} · {DEMO_USER_TAG}"
            user.created_at = created_at
        users.append(user)
    return users


# ── 订单 ──────────────────────────────────────────────────────────────────

def _reset_demo_orders(db: Session, now: datetime, users: list[User]) -> int:
    """删除上次生成的演示订单，再按固定随机种子重建。"""
    stale = db.query(Order).filter(Order.order_no.like(f"{DEMO_ORDER_PREFIX}%")).all()
    for order in stale:
        db.delete(order)
    db.flush()

    products = db.query(Product).filter(Product.status == "active").all()
    if not products:
        print("没有可用商品，跳过演示订单")
        return 0

    rng = random.Random(20261121)
    per_day = [2] * 7 + [1] * 7
    rng.shuffle(per_day)

    seq = 0
    created_rows = 0
    for day in range(13, -1, -1):
        for _ in range(per_day[day]):
            seq += 1
            created = now - timedelta(days=day)
            created = created.replace(
                hour=rng.randint(9, 19),
                minute=rng.randint(0, 59),
                second=rng.randint(0, 59),
                microsecond=0,
            )
            if created > now:
                created = now - timedelta(minutes=20 * seq)

            used: set[int] = set()
            items: list[OrderItem] = []
            total = Decimal("0.00")
            for _ in range(rng.randint(1, 2)):
                pool = [p for p in products if p.id not in used]
                if not pool:
                    break
                product = pool[rng.randrange(len(pool))]
                used.add(product.id)
                quantity = rng.randint(1, 3)
                unit_price = Decimal(str(product.price))
                subtotal = (unit_price * quantity).quantize(Decimal("0.01"))
                total += subtotal
                items.append(
                    OrderItem(
                        product_id=product.id,
                        product_name=product.name,
                        quantity=quantity,
                        unit_price=unit_price,
                        subtotal=subtotal,
                    )
                )

            user = users[rng.randrange(len(users))]
            delivery_type = "pickup" if rng.random() < 0.25 else "express"
            if day == 0:
                status = "pending" if seq % 2 else "confirmed"
            else:
                status = STATUS_POOL[rng.randrange(len(STATUS_POOL))]

            order = Order(
                order_no=f"{DEMO_ORDER_PREFIX}{created:%Y%m%d}{seq:03d}",
                user_id=user.id,
                total_amount=total,
                status=status,
                delivery_type=delivery_type,
                delivery_address=(
                    "护花使者 · 徐汇门店（演示自提点）"
                    if delivery_type == "pickup"
                    else DEMO_ADDRESSES[rng.randrange(len(DEMO_ADDRESSES))]
                ),
                contact_name=user.bio.split(" ")[0] if user.bio else user.username,
                contact_phone=f"138****{1000 + seq:04d}",
                remark="[演示数据] 由 seed_demo 生成" + ("，请在工作日送达" if seq % 5 == 0 else ""),
                created_at=created,
                updated_at=created,
                items=items,
            )
            db.add(order)
            created_rows += 1
    return created_rows


# ── 设备 ──────────────────────────────────────────────────────────────────

def _build_readings(seed: dict, end: datetime, now: datetime, rng: random.Random) -> list[DeviceReading]:
    """按演示前端的公式生成一条 24 小时曲线。

    数据库按 UTC 存时间；日照曲线要跟着**本地**时钟走，
    所以用 ``now`` 与 ``utcnow`` 的差值把时间换算成当地时间再算角度。
    """
    offset = now - datetime.utcnow()
    start = end - timedelta(hours=24)
    rows: list[DeviceReading] = []
    for i in range(POINTS):
        at = start + timedelta(minutes=STEP_MIN * i)
        local = at + offset
        hour = local.hour + local.minute / 60

        moisture = seed["base_moisture"] + 2.5 * math.sin((hour - 4.2) / 24 * math.pi * 2)
        for event_hour in seed["water_events"]:
            if hour >= event_hour:
                moisture += 14 * math.exp(-(hour - event_hour) / 2.6)
        if seed.get("dry"):
            moisture -= 3.2
        moisture = max(6.0, min(96.0, moisture))

        if seed.get("no_light_sensor"):
            lux = None
        else:
            daylight = max(0.0, math.sin((hour - 6.2) / 12.6 * math.pi))
            cloud = 0.72 + rng.random() * 0.28
            lux = round(daylight * seed["lux_peak"] * cloud + rng.random() * 45)

        temp = (
            seed["temp_base"]
            + 1.9 * math.sin((hour - 9) / 24 * math.pi * 2)
            + (rng.random() - 0.5) * 0.5
        )

        rows.append(
            DeviceReading(
                soil_moisture=round(moisture, 1),
                soil_temp=round(temp, 1),
                light_lux=lux,
                firmware=seed["firmware"],
                ip_address=seed["ip"],
                created_at=at,
            )
        )
    return rows


def _reset_demo_devices(db: Session, now: datetime) -> list[Device]:
    codes = [seed["code"] for seed in DEVICE_SEEDS]

    # 只删带演示后缀的设备，避免误删真实硬件档案
    stale = (
        db.query(Device)
        .filter(Device.code.in_(codes), Device.name.like(f"%{DEMO_DEVICE_SUFFIX}"))
        .all()
    )
    for device in stale:
        db.delete(device)
    db.flush()

    rng = random.Random(20261121)
    devices: list[Device] = []
    for index, seed in enumerate(DEVICE_SEEDS):
        code = seed["code"]
        existing = db.query(Device).filter(Device.code == code).first()
        if existing is not None:
            print(f"警告：{code} 已存在且不是演示设备，跳过（不会覆盖真实硬件）")
            continue

        last_seen = now - timedelta(seconds=seed["last_seen_sec"])
        moisture_min, moisture_max, temp_min, temp_max, lux_min, lux_max = seed["thresholds"]
        air_raw, water_raw, calibration_source = seed["calibration"]
        device = Device(
            code=code,
            name=f"{seed['name']}{DEMO_DEVICE_SUFFIX}",
            location=seed["location"],
            firmware=seed["firmware"],
            ip_address=seed["ip"],
            report_interval=10,
            last_seen=last_seen,
            enabled=True,
            moisture_min=moisture_min,
            moisture_max=moisture_max,
            temp_min=temp_min,
            temp_max=temp_max,
            lux_min=lux_min,
            lux_max=lux_max,
            alarm_enabled=True,
            air_raw=air_raw,
            water_raw=water_raw,
            calibration_source=calibration_source,
            created_at=now - timedelta(days=28 - index * 3),
            updated_at=now,
        )
        db.add(device)
        db.flush()

        device.readings = _build_readings(seed, last_seen, now, rng)
        devices.append(device)
    return devices


def _seed_demo_alerts(db: Session, now: datetime, devices: list[Device]) -> int:
    """写入 7 条历史告警：5 条未确认，2 条已确认。

    离线设备（004 / 006）的告警由后端 ``_sync_offline_alerts`` 自动补，
    这里不重复插入。
    """
    by_code = {device.code: device for device in devices}
    specs = [
        # code, metric, label, value, threshold, direction, level, hint, minutes_ago, ack
        ("FG-ESP32-003", "soil_moisture", "土壤湿度", 31.4, 45, "below", "danger",
         "低于下限，薄荷需水量较高，建议检查浇水与滴灌。", 42, False),
        ("FG-ESP32-003", "light_lux", "光照", 1280, 3000, "below", "warn",
         "午后光照骤降，可能是遮阳帘挡住了光。", 8 * 60, False),
        ("FG-ESP32-005", "light_lux", "光照传感器", None, 200, "missing", "warn",
         "BH1750 未接入或读取失败，固件上报 light_lux 为 null。", 61, False),
        ("FG-ESP32-001", "soil_moisture", "土壤湿度", 69.4, 70, "near", "warn",
         "接近上限，已确认：刚完成浇水。", 5 * 60, True),
        ("FG-ESP32-002", "soil_temp", "土壤温度", 14.2, 14, "below", "warn",
         "夜间低于下限，已确认：开窗通风导致。", 19 * 60, True),
    ]

    count = 0
    for (code, metric, label, value, threshold, direction, level,
         hint, minutes_ago, acknowledged) in specs:
        device = by_code.get(code)
        if device is None:
            continue
        at = now - timedelta(minutes=minutes_ago)
        db.add(DeviceAlert(
            device_id=device.id,
            metric=metric,
            label=label,
            value=value,
            threshold=threshold,
            direction=direction,
            level=level,
            hint=hint,
            acknowledged=acknowledged,
            acknowledged_at=at if acknowledged else None,
            created_at=at,
        ))
        count += 1
    return count


def touch_online_devices(db: Session) -> int:
    """刷新在线设备的 ``last_seen`` 并补一条读数，让 90 秒窗口重新生效。"""
    now = datetime.utcnow()
    touched = 0
    for code in sorted(ONLINE_CODES):
        device = db.query(Device).filter(Device.code == code).first()
        if device is None:
            continue
        latest = (
            db.query(DeviceReading)
            .filter(DeviceReading.device_id == device.id)
            .order_by(DeviceReading.created_at.desc())
            .first()
        )
        if latest is not None:
            db.add(DeviceReading(
                device_id=device.id,
                soil_moisture=latest.soil_moisture,
                soil_temp=latest.soil_temp,
                light_lux=latest.light_lux,
                firmware=device.firmware,
                ip_address=device.ip_address,
                created_at=now,
            ))
        device.last_seen = now
        touched += 1
    db.commit()
    return touched


def seed_demo(db: Session) -> None:
    from app.db.seed_plants import seed_plants
    from app.db.seed_products import seed_products

    now = datetime.utcnow()

    seed_plants(db)
    seed_products(db)

    admin = _ensure_admin(db, now)
    users = _upsert_demo_users(db, now)
    orders = _reset_demo_orders(db, now, users)
    devices = _reset_demo_devices(db, now)
    alerts = _seed_demo_alerts(db, now, devices)

    db.commit()

    print("演示数据已就绪：")
    print(f"  管理员   {ADMIN_USERNAME} / {ADMIN_PASSWORD}")
    print(f"  演示用户 {len(users)} 个（密码 {DEMO_PASSWORD}）")
    print(f"  演示订单 {orders} 笔")
    print(f"  演示设备 {len(devices)} 台，历史告警 {alerts} 条（离线告警由接口自动补）")
    print(f"  管理员 id={admin.id}")


def main() -> None:
    parser = argparse.ArgumentParser(description="护花使者管理后台演示数据种子")
    parser.add_argument(
        "--touch",
        action="store_true",
        help="只刷新在线设备心跳，不重建任何数据",
    )
    args = parser.parse_args()

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if args.touch:
            count = touch_online_devices(db)
            print(f"已刷新 {count} 台在线设备的 last_seen")
        else:
            seed_demo(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()