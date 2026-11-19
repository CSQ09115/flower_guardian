"""花盆设备（ESP32-S3）的档案、读数与阈值告警。

固件每 10 秒 POST 一次读数到 /api/devices/{code}/readings；
设备第一次上报时自动建档，之后后台只维护阈值、标定记录与显示名称。
"""

from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.db.base import Base


class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False, default="未命名花盆")
    location = Column(String(120), nullable=True)

    # 最近一次上报带下来的信息
    firmware = Column(String(20), nullable=True)
    ip_address = Column(String(64), nullable=True)
    report_interval = Column(Integer, default=10)
    last_seen = Column(DateTime, nullable=True)

    enabled = Column(Boolean, default=True)

    # 阈值：湿度 % / 土温 ℃ / 光照 lx
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

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    readings = relationship(
        "DeviceReading", back_populates="device", cascade="all, delete-orphan"
    )
    alerts = relationship(
        "DeviceAlert", back_populates="device", cascade="all, delete-orphan"
    )


class DeviceReading(Base):
    __tablename__ = "device_readings"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)

    soil_moisture = Column(Float, nullable=True)
    soil_temp = Column(Float, nullable=True)
    light_lux = Column(Float, nullable=True)

    firmware = Column(String(20), nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    device = relationship("Device", back_populates="readings")


# 查询"某设备最近 24 小时读数"时最常用的组合
Index("ix_device_readings_device_created", DeviceReading.device_id, DeviceReading.created_at)


class DeviceAlert(Base):
    __tablename__ = "device_alerts"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(Integer, ForeignKey("devices.id"), nullable=False, index=True)

    metric = Column(String(24), nullable=False)  # soil_moisture / soil_temp / light_lux / online
    label = Column(String(40), nullable=True)
    value = Column(Float, nullable=True)
    threshold = Column(Float, nullable=True)
    direction = Column(String(16), nullable=True)  # below / above / missing / offline
    level = Column(String(16), default="warn")  # warn / danger
    hint = Column(String(255), nullable=True)

    acknowledged = Column(Boolean, default=False)
    acknowledged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    device = relationship("Device", back_populates="alerts")
