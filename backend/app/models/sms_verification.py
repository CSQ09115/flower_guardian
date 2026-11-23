from sqlalchemy import Column, Integer, String, DateTime, Boolean
from datetime import datetime, timedelta

from app.db.base import Base


class SmsVerification(Base):
    """短信验证码：用于手机号验证码登录等场景。"""

    __tablename__ = "sms_verifications"

    id = Column(Integer, primary_key=True, index=True)
    mobile = Column(String(20), nullable=False, index=True)
    code = Column(String(6), nullable=False)
    purpose = Column(String(50), default="login", nullable=False)  # login
    used = Column(Boolean, default=False, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    @property
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at

    @classmethod
    def new_code(cls, mobile: str, code: str, purpose: str, minutes: int = 5) -> "SmsVerification":
        return cls(
            mobile=mobile,
            code=code,
            purpose=purpose,
            expires_at=datetime.utcnow() + timedelta(minutes=minutes),
        )
