from sqlalchemy import Column, DateTime, String, Text
from datetime import datetime

from app.core.database import Base


class SystemConfig(Base):
    """系统配置项（键值对，key 形如 weather.api_key）"""

    __tablename__ = "system_configs"

    key = Column(String(100), primary_key=True, index=True)
    value = Column(Text, nullable=False, default="")
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
