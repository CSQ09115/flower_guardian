from sqlalchemy import Column, Integer, String, DateTime, Text
from datetime import datetime
from app.db.base import Base


class EmailSendLog(Base):
    """邮件发送日志：记录每次系统邮件的发送结果，供后台「日志-邮件发送」查看。"""

    __tablename__ = "email_send_logs"

    id = Column(Integer, primary_key=True, index=True)
    recipient = Column(String(100), nullable=False, index=True)
    subject = Column(String(200), nullable=False)
    purpose = Column(String(50), default="", nullable=False)
    # success / failed
    status = Column(String(20), nullable=False, index=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
