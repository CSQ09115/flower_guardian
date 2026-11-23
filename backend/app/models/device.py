"""
设备与传感器数据模型（护花使者 IoT 模块）
=========================================
这是本项目新增的硬件接入部分：
  Device        —— 一块 ESP32（对应一盆花）
  SensorReading —— 一条传感器读数

设计要点（面向学生讲解）：
  1. device_code 用字符串而不是外键：设备上报时可能还没绑定用户，
     用编号（如 FG-ESP32-001）作为业务主键更灵活，也方便设备端直接上报。
  2. 所有传感器字段都允许为空（nullable=True）：
     这样"先接土壤湿度、后接温度"的分阶段开发不会打断，
     缺哪个传感器就留空，App 端按字段是否存在来显示。
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from datetime import datetime
from app.db.base import Base

# 土壤湿度低于此值就认为"该浇水了"（百分比）
# ⚠️ 真实阈值要等传感器到货后，按"干土/湿土标定"实测确定，这里先给经验值
DRY_THRESHOLD = 30.0


class Device(Base):
    """一台设备（一块 ESP32 开发板，可绑定一盆花）"""
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, index=True, nullable=False)  # 设备编号 FG-ESP32-001
    name = Column(String(64), default="未命名设备")
    plant_name = Column(String(64), default="")          # 这盆花叫什么
    location = Column(String(100), default="")           # 摆放位置（阳台/客厅…）
    firmware = Column(String(32), default="")            # 固件版本
    ip_address = Column(String(32), default="")          # 设备局域网 IP
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # 归属用户（可后续绑定）
    last_seen = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # ── 设备管理模块新增列（阈值 / 标定 / 启停，老库由 main.py 启动迁移补列）──
    report_interval = Column(Integer, default=10)        # 上报周期（秒）
    enabled = Column(Boolean, default=True)              # 启用/停用

    # 告警阈值：湿度 % / 土温 ℃ / 光照 lx
    moisture_min = Column(Float, default=35.0)
    moisture_max = Column(Float, default=70.0)
    temp_min = Column(Float, default=12.0)
    temp_max = Column(Float, default=30.0)
    lux_min = Column(Float, default=500.0)
    lux_max = Column(Float, default=30000.0)
    alarm_enabled = Column(Boolean, default=True)

    # 土壤湿度两点标定（仅记录，不下发到设备）
    air_raw = Column(Integer, default=3200)
    water_raw = Column(Integer, default=1300)
    calibration_source = Column(String(40), default="出厂默认")

    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DeviceAlert(Base):
    """设备告警：读数越界或离线时生成；同一设备同一指标只保留一条未确认记录。"""
    __tablename__ = "device_alerts"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)

    metric = Column(String(24), nullable=False)      # soil_moisture / soil_temp / light_lux / online
    label = Column(String(40), nullable=True)
    value = Column(Float, nullable=True)
    threshold = Column(Float, nullable=True)
    direction = Column(String(16), nullable=True)    # below / above / missing / offline
    level = Column(String(16), default="warn")       # warn / danger
    hint = Column(String(255), nullable=True)

    acknowledged = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class SensorReading(Base):
    """一条传感器读数"""
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True)
    device_code = Column(String(64), index=True, nullable=False)
    soil_moisture = Column(Float, nullable=True)   # 土壤湿度 %
    soil_temp = Column(Float, nullable=True)       # 土壤温度 ℃
    air_temp = Column(Float, nullable=True)        # 空气温度 ℃
    air_humidity = Column(Float, nullable=True)    # 空气湿度 %
    light_lux = Column(Float, nullable=True)       # 光照 lux
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
