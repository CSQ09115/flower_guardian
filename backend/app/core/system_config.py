"""系统配置：分组定义、读写与运行时取值。

天气、SMTP、AI、支付、QQ/微信登录、YOLO 六组业务配置只从 system_configs 表读取，
不再回退 .env；未配置时由调用方使用代码内置的非敏感默认值或返回“未配置”状态。
数据库连接、JWT 密钥等基础设施配置仍由 settings/.env 提供，不在此范围。
"""
import logging
from typing import Any, Dict, List, Optional

from app.core.database import SessionLocal
from app.models.system_config import SystemConfig

# 配置分组与字段定义（前端按此渲染表单）
CONFIG_GROUPS: List[Dict[str, Any]] = [
    {
        "key": "weather",
        "title": "天气 API 接口管理",
        "description": "天气服务地址与密钥，仅从数据库读取；未填写密钥时天气功能会提示未配置。",
        "fields": [
            {"key": "base_url", "label": "服务地址", "type": "text", "default": "https://devapi.qweather.com/v7"},
            {"key": "api_key", "label": "API Key", "type": "secret"},
            {"key": "default_city", "label": "默认城市", "type": "text"},
            {"key": "extra_params", "label": "默认参数（如 lang=zh）", "type": "text"},
        ],
    },
    {
        "key": "smtp",
        "title": "SMTP 发件箱配置",
        "description": "用于验证码等邮件发送，仅从数据库读取；未填写账号或授权码时不会发送邮件。SSL 模式使用 465 端口直连，非 SSL 模式默认 587 端口 STARTTLS。",
        "fields": [
            {"key": "host", "label": "SMTP Host", "type": "text", "default": "smtp.qq.com"},
            {"key": "port", "label": "端口", "type": "number", "default": "587"},
            {"key": "user", "label": "账号", "type": "text"},
            {"key": "password", "label": "密码 / 授权码", "type": "secret"},
            {"key": "from_name", "label": "发件人名称", "type": "text"},
            {"key": "ssl", "label": "启用 SSL", "type": "bool", "default": "0"},
        ],
    },
    {
        "key": "sms",
        "title": "短信验证码（互亿无线）",
        "description": "用于手机号短信验证码登录。APIID / APIKEY 请在互亿无线用户中心【文本短信】查看，仅保存在数据库，不会写死在代码中。短信模板 ID 填已备案模板；调试阶段可填系统默认模板 1（您的验证码是：【变量】）。填写完整后短信登录才会生效。",
        "fields": [
            {"key": "api_id", "label": "APIID", "type": "text"},
            {"key": "api_key", "label": "APIKEY", "type": "secret"},
            {"key": "template_id", "label": "短信模板 ID", "type": "text", "default": "1"},
        ],
    },
    {
        "key": "ai",
        "title": "AI 问诊接口对接",
        "description": "兼容 OpenAI 协议的接口地址，仅从数据库读取；未填写 API Key 时 AI 功能会提示未配置。",
        "fields": [
            {"key": "base_url", "label": "Base URL", "type": "text", "default": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"},
            {"key": "model", "label": "模型名", "type": "text", "default": "qwen-turbo"},
            {"key": "api_key", "label": "API Key", "type": "secret"},
        ],
    },
    {
        "key": "payment",
        "title": "支付 API 配置",
        "description": "易支付 / 码支付商户信息，当前支付为模拟流程，配置已落库供后续接入。",
        "fields": [
            {"key": "epay_mch_id", "label": "易支付 - 商户号", "type": "text"},
            {"key": "epay_key", "label": "易支付 - 密钥", "type": "secret"},
            {"key": "epay_gateway", "label": "易支付 - 网关地址", "type": "text"},
            {"key": "codepay_mch_id", "label": "码支付 - 商户号", "type": "text"},
            {"key": "codepay_key", "label": "码支付 - 密钥", "type": "secret"},
            {"key": "codepay_gateway", "label": "码支付 - 网关地址", "type": "text"},
        ],
    },
    {
        "key": "login",
        "title": "QQ / 微信登录",
        "description": "聚合登录 API 配置，当前后端未接入第三方登录，配置已落库供后续接入。",
        "fields": [
            {"key": "api_url", "label": "聚合登录 API 地址", "type": "text"},
            {"key": "app_id", "label": "AppID", "type": "text"},
            {"key": "app_key", "label": "AppKey", "type": "secret"},
            {"key": "callback_url", "label": "回调地址", "type": "text"},
        ],
    },
]

_GROUP_MAP = {group["key"]: group for group in CONFIG_GROUPS}


def _field_map(group: str) -> Dict[str, Dict[str, Any]]:
    group_spec = _GROUP_MAP.get(group, {})
    return {field["key"]: field for field in group_spec.get("fields", [])}


def is_valid_group(group: str) -> bool:
    return group in _GROUP_MAP


def is_secret_field(group: str, field: str) -> bool:
    return _field_map(group).get(field, {}).get("type") == "secret"


def get_group_values(group: str, db=None) -> Dict[str, str]:
    """读取某分组的全部配置值；读取异常时返回空字典，不向调用方抛错。"""
    own_session = db is None
    session = db or SessionLocal()
    try:
        rows = session.query(SystemConfig).filter(
            SystemConfig.key.like(f"{group}.%")
        ).all()
        return {row.key.split(".", 1)[1]: row.value for row in rows}
    except Exception as exc:
        logging.warning("读取系统配置 %s 失败: %s", group, exc)
        return {}
    finally:
        if own_session:
            session.close()


def get_config_value(group: str, field: str, fallback: Optional[str] = None) -> Optional[str]:
    """读取单个配置值，空值返回 fallback（仅用于代码内置的非敏感默认值）。"""
    value = get_group_values(group).get(field)
    if value is None or value == "":
        return fallback
    return value


def save_group_values(group: str, values: Dict[str, str], db) -> None:
    """保存分组配置；secret 字段传空表示保持原值不变。"""
    fields = _field_map(group)
    for field, value in values.items():
        if field not in fields:
            continue
        if is_secret_field(group, field) and value == "":
            continue
        key = f"{group}.{field}"
        row = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        if row:
            row.value = value
        else:
            db.add(SystemConfig(key=key, value=value))
    db.commit()
