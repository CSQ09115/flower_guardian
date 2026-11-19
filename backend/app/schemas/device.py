"""设备相关的请求 / 响应模型。"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict


class ThresholdPayload(BaseModel):
    moistureMin: float = Field(35, ge=0, le=100)
    moistureMax: float = Field(70, ge=0, le=100)
    tempMin: float = Field(12, ge=-40, le=80)
    tempMax: float = Field(30, ge=-40, le=80)
    luxMin: float = Field(500, ge=0)
    luxMax: float = Field(30000, ge=0)
    alarm: bool = True


class CalibrationPayload(BaseModel):
    airRaw: int = Field(3200, ge=0, le=65535)
    waterRaw: int = Field(1300, ge=0, le=65535)
    source: Optional[str] = None


class ReadingCreate(BaseModel):
    """固件 postReading() 的报文，字段名与 firmware/README.md 第 9 节一致。"""

    model_config = ConfigDict(extra="ignore")

    soil_moisture: Optional[float] = None
    soil_temp: Optional[float] = None
    light_lux: Optional[float] = None
    firmware: Optional[str] = None
    ip_address: Optional[str] = None
    # 兼容部分固件把设备名一起带上来的情况
    name: Optional[str] = None


class ReadingResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_code: str
    soil_moisture: Optional[float] = None
    soil_temp: Optional[float] = None
    light_lux: Optional[float] = None
    firmware: Optional[str] = None
    ip_address: Optional[str] = None
    created_at: datetime


class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    device_code: str
    metric: str
    label: Optional[str] = None
    value: Optional[float] = None
    threshold: Optional[float] = None
    direction: Optional[str] = None
    level: str = "warn"
    hint: Optional[str] = None
    acknowledged: bool = False
    at: Optional[datetime] = None


class DeviceCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=64)
    name: Optional[str] = None
    location: Optional[str] = None
    thresholds: Optional[ThresholdPayload] = None
    calibration: Optional[CalibrationPayload] = None


class DeviceUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    enabled: Optional[bool] = None
    thresholds: Optional[ThresholdPayload] = None
    calibration: Optional[CalibrationPayload] = None


class DeviceResponse(BaseModel):
    id: int
    code: str
    name: str
    location: Optional[str] = None
    firmware: Optional[str] = None
    ip_address: Optional[str] = None
    report_interval: int = 10
    enabled: bool = True
    last_seen: Optional[datetime] = None
    created_at: Optional[datetime] = None
    thresholds: ThresholdPayload
    calibration: CalibrationPayload
    readings: List[ReadingResponse] = []
    latest_reading: Optional[ReadingResponse] = None


class DeviceListResponse(BaseModel):
    total: int
    items: List[DeviceResponse]


class DeviceOverview(BaseModel):
    total: int
    online: int
    offline: int
    alarm: int
    avg_moisture: Optional[float] = None
    last_seen: Optional[datetime] = None
