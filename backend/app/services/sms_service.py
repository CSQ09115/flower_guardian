import logging
import requests

logger = logging.getLogger(__name__)

# 互亿无线短信 API（配置（APIID/APIKEY/模板ID）全部保存在后台数据库，不写死在代码中）
SMS_API_URL = "https://api.ihuyi.com/sms/Submit.json"


def _log_sms_result(mobile: str, purpose: str, success: bool, error: str) -> None:
    """把每次短信发送结果写入 sms_send_logs，供后台「日志 - 短信发送」查看。"""
    try:
        from app.core.database import SessionLocal
        from app.models.sms_log import SmsSendLog

        with SessionLocal() as db:
            db.add(SmsSendLog(
                recipient=mobile,
                purpose=purpose,
                status="success" if success else "failed",
                error=error or None,
            ))
            db.commit()
    except Exception:
        logger.exception("写入短信发送日志失败")


def send_sms_code(mobile: str, code: str, purpose: str = "sms_login") -> tuple[bool, str]:
    """通过互亿无线发送验证码短信。

    使用模板变量方式：模板 ID 由后台配置（调试可用系统默认模板 1，
    内容为「您的验证码是：【变量】。请不要把验证码泄露给其他人。」），
    content 只传验证码变量。

    返回 (是否成功, 失败原因描述)。
    """
    from app.core.system_config import get_config_value

    account = get_config_value("sms", "api_id")
    password = get_config_value("sms", "api_key")
    template_id = (get_config_value("sms", "template_id") or "1").strip()

    if not account or not password:
        logger.warning("短信平台未配置（APIID/APIKEY 为空），跳过发送")
        _log_sms_result(mobile, purpose, False, "短信平台未配置，请在后台「系统配置 - 短信」中填写")
        return False, "短信平台未配置，请联系管理员在后台「系统配置 - 短信」中填写"

    payload = {
        "account": account,
        "password": password,
        "mobile": mobile,
        # 模板变量方式：content 只传变量（验证码）
        "content": code,
        "templateid": template_id,
    }

    try:
        response = requests.post(
            SMS_API_URL,
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=15,
        )
        response.raise_for_status()
        result = response.json()
    except requests.RequestException as exc:
        logger.exception("短信请求失败: %s", exc)
        _log_sms_result(mobile, purpose, False, f"短信网关请求失败：{exc}")
        return False, f"短信网关请求失败：{exc}"
    except ValueError:
        logger.exception("短信网关返回非 JSON 响应: %s", response.text[:200])
        _log_sms_result(mobile, purpose, False, "短信网关响应异常，请稍后重试")
        return False, "短信网关响应异常，请稍后重试"

    # 互亿无线约定：code == 2 表示提交成功
    if result.get("code") == 2:
        logger.info("短信发送成功: mobile=%s smsid=%s", mobile, result.get("smsid"))
        _log_sms_result(mobile, purpose, True, "")
        return True, ""

    msg = result.get("msg") or "提交失败"
    code_num = result.get("code")
    logger.warning("短信发送失败: mobile=%s code=%s msg=%s", mobile, code_num, msg)
    _log_sms_result(mobile, purpose, False, f"短信发送失败（{code_num}）：{msg}")
    return False, f"短信发送失败（{code_num}）：{msg}"
