"""设备与传感器数据的请求/响应模型"""
from pydantic import BaseModel, Field, ConfigDict, AliasChoices
from typing import Optional, List
from datetime import datetime


class ReadingCreate(BaseModel):
    """设备上报的数据（字段全部可空，方便分阶段接传感器）

    注意：不做 ge/le 硬校验——传感器未标定时固件可能上报原始 ADC 值
    （0-4095）或错误值（如 -127），拒收会导致整条数据丢失，
    这里放宽为任意浮点数，由阈值告警与标定功能在业务层处理。
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    soil_moisture: Optional[float] = None
    soil_temp: Optional[float] = None
    air_temp: Optional[float] = None
    # 兼容 0.5.0 固件的拼写错误 "air_humidty"
    air_humidity: Optional[float] = Field(
        None, validation_alias=AliasChoices("air_humidity", "air_humidty")
    )
    light_lux: Optional[float] = None
    firmware: Optional[str] = None
    ip_address: Optional[str] = None


class ReadingResponse(BaseModel):
    id: int
    device_code: str
    soil_moisture: Optional[float] = None
    soil_temp: Optional[float] = None
    air_temp: Optional[float] = None
    air_humidity: Optional[float] = None
    light_lux: Optional[float] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DeviceResponse(BaseModel):
    """设备列表里的每一项：设备信息 + 最新一条读数 + 是否需要浇水"""
    code: str
    name: str
    plant_name: str
    location: str
    firmware: str
    ip_address: str
    last_seen: Optional[datetime] = None
    latest: Optional[ReadingResponse] = None
    need_water: bool = False
    dry_threshold: float = 30.0

    class Config:
        from_attributes = True


class LatestResponse(BaseModel):
    """某设备的最新读数"""
    device_code: str
    soil_moisture: Optional[float] = None
    soil_temp: Optional[float] = None
    air_temp: Optional[float] = None
    air_humidity: Optional[float] = None
    light_lux: Optional[float] = None
    created_at: Optional[datetime] = None
    need_water: bool = False
    dry_threshold: float = 30.0


class DeviceBindRequest(BaseModel):
    """把设备绑定到某个用户和某盆花"""
    user_id: Optional[int] = None
    plant_name: Optional[str] = None
    location: Optional[str] = None
    name: Optional[str] = None


# ───────────────────────────────────────────────────────────────────────────
# 管理后台"设备管理"模块（阈值告警 / 标定 / 告警确认）
# ───────────────────────────────────────────────────────────────────────────

class ThresholdPayload(BaseModel):
    """阈值设置（camelCase 与前端字段一一对应）"""
    moistureMin: float = Field(35, ge=0, le=100)
    moistureMax: float = Field(70, ge=0, le=100)
    tempMin: float = Field(12, ge=-40, le=80)
    tempMax: float = Field(30, ge=-40, le=80)
    airTempMin: float = Field(5, ge=-40, le=80)
    airTempMax: float = Field(35, ge=-40, le=80)
    airHumidityMin: float = Field(20, ge=0, le=100)
    airHumidityMax: float = Field(90, ge=0, le=100)
    luxMin: float = Field(500, ge=0)
    luxMax: float = Field(30000, ge=0)
    alarm: bool = True


class CalibrationPayload(BaseModel):
    """土壤湿度两点标定（airRaw 干土 ADC / waterRaw 湿土 ADC）"""
    airRaw: int = Field(3200, ge=0, le=65535)
    waterRaw: int = Field(1300, ge=0, le=65535)
    source: Optional[str] = None


class AdminDeviceCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=64)
    name: Optional[str] = None
    location: Optional[str] = None
    thresholds: Optional[ThresholdPayload] = None
    calibration: Optional[CalibrationPayload] = None


class AdminDeviceUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    enabled: Optional[bool] = None
    thresholds: Optional[ThresholdPayload] = None
    calibration: Optional[CalibrationPayload] = None


class AdminDeviceResponse(BaseModel):
    """管理后台的设备详情：档案 + 在线状态 + 阈值/标定 + 最新读数"""
    id: int
    code: str
    name: str
    plant_name: Optional[str] = None
    location: Optional[str] = None
    firmware: Optional[str] = None
    ip_address: Optional[str] = None
    report_interval: int = 10
    enabled: bool = True
    online: bool = False
    last_seen: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    thresholds: ThresholdPayload
    calibration: CalibrationPayload
    latest_reading: Optional[ReadingResponse] = None

    class Config:
        from_attributes = True


class AdminDeviceListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[AdminDeviceResponse]


class DeviceOverviewResponse(BaseModel):
    """设备统计：总数 / 在线 / 离线 / 未确认告警数"""
    total: int
    online: int
    offline: int
    unacknowledged_alerts: int


class DeviceAlertResponse(BaseModel):
    id: int
    device_id: int
    device_code: str
    device_name: Optional[str] = None
    metric: str
    label: Optional[str] = None
    value: Optional[float] = None
    threshold: Optional[float] = None
    direction: Optional[str] = None
    level: str = "warn"
    hint: Optional[str] = None
    acknowledged: bool = False
    acknowledged_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class DeviceAlertListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: List[DeviceAlertResponse]
