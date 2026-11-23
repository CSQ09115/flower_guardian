from pydantic_settings import BaseSettings
from typing import Optional
import os


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://user:password@localhost:5555/flower_guardian"
    SECRET_KEY: str = "secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # SMTP配置
    SMTP_HOST: str = "smtp.qq.com"
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    # Qwen AI配置 (OpenAI兼容接口)
    QWEN_API_KEY: str = ""
    QWEN_BASE_URL: str = "https://token-plan.maas.qianwenaiapi.com/compatible-mode/v1"
    QWEN_MODEL: str = "qwen-turbo"

    # 和风天气API配置
    HEFENG_KEY: str = ""

    class Config:
        env_file = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env")
        extra = "ignore"


settings = Settings()
