import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.header import Header
import random
import string
import logging

logger = logging.getLogger(__name__)

# SMTP 服务地址/端口为通用非敏感默认值，允许代码内置；账号密码等密钥只从数据库读取
DEFAULT_SMTP_HOST = "smtp.qq.com"
DEFAULT_SMTP_PORT = 587


def generate_code(length: int = 6) -> str:
    return ''.join(random.choices(string.digits, k=length))


def _log_email_send(recipient: str, subject: str, purpose: str, status: str, error: str = "") -> None:
    """写入邮件发送日志；日志失败不影响发送流程。"""
    try:
        from app.core.database import SessionLocal
        from app.models.email_log import EmailSendLog

        session = SessionLocal()
        try:
            session.add(EmailSendLog(
                recipient=recipient,
                subject=subject[:200],
                purpose=purpose,
                status=status,
                error=(error or "")[:2000],
            ))
            session.commit()
        finally:
            session.close()
    except Exception as exc:  # pragma: no cover - 日志兜底
        logger.warning("写入邮件发送日志失败: %s", exc)


def send_email(to_email: str, subject: str, body: str, purpose: str = "") -> bool:
    # SMTP 配置只从后台数据库读取，不回退 .env；未配置时返回失败并记录日志
    from app.core.system_config import get_config_value
    smtp_host = get_config_value("smtp", "host") or DEFAULT_SMTP_HOST
    try:
        smtp_port = int(get_config_value("smtp", "port") or DEFAULT_SMTP_PORT)
    except (TypeError, ValueError):
        smtp_port = DEFAULT_SMTP_PORT
    smtp_user = get_config_value("smtp", "user")
    smtp_password = get_config_value("smtp", "password")
    from_name = get_config_value("smtp", "from_name")
    use_ssl = (get_config_value("smtp", "ssl") or "0") == "1"

    if not smtp_user or not smtp_password:
        logger.warning("SMTP 未配置，跳过邮件发送（请在后台「系统配置 - SMTP」中填写）")
        _log_email_send(to_email, subject, purpose, "failed", "SMTP 未配置")
        return False

    msg = MIMEMultipart()
    # QQ邮箱只使用邮箱地址
    msg['From'] = f"{Header(from_name, 'utf-8').encode()} <{smtp_user}>" if from_name else smtp_user
    msg['To'] = to_email
    msg['Subject'] = subject

    msg.attach(MIMEText(body, 'html', 'utf-8'))

    server = None
    try:
        logger.info("Sending email to: %s (host=%s port=%s ssl=%s)", to_email, smtp_host, smtp_port, use_ssl)
        # SSL 模式使用 SMTP_SSL 直连（通常 465 端口）；非 SSL 模式建立连接后升级 STARTTLS
        if use_ssl:
            server = smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=30)
        else:
            server = smtplib.SMTP(smtp_host, smtp_port, timeout=30)
            server.starttls()
        server.login(smtp_user, smtp_password)
        server.send_message(msg)
        server.quit()
        logger.info("Email sent successfully to %s", to_email)
        _log_email_send(to_email, subject, purpose, "success")
        return True
    except Exception as e:
        logger.exception("Failed to send email: %s", e)
        if server is not None:
            try:
                server.quit()
            except Exception:
                pass
        _log_email_send(to_email, subject, purpose, "failed", str(e))
        return False


def send_verification_email(email: str, code: str, purpose: str) -> bool:
    if purpose == "register":
        subject = "【护花使者】邮箱验证"
        body = f"""
        <html>
        <body>
            <h2 style="color: #4CAF50;">欢迎注册护花使者</h2>
            <p>您的邮箱验证码是：<strong style="font-size: 24px; color: #4CAF50;">{code}</strong></p>
            <p>验证码有效期为30分钟，请尽快完成验证。</p>
            <p style="color: #999;">如果不是您本人操作，请忽略此邮件。</p>
        </body>
        </html>
        """
    elif purpose == "bind_email":
        subject = "【护花使者】绑定邮箱验证"
        body = f"""
        <html>
        <body>
            <h2 style="color: #4CAF50;">绑定邮箱验证</h2>
            <p>您的验证码是：<strong style="font-size: 24px; color: #4CAF50;">{code}</strong></p>
            <p>验证码有效期为15分钟。若该邮箱已有账号，绑定后数据将自动合并。</p>
            <p style="color: #999;">如果不是您本人操作，请忽略此邮件。</p>
        </body>
        </html>
        """
    else:  # password_reset
        subject = "【护花使者】密码重置"
        body = f"""
        <html>
        <body>
            <h2 style="color: #FF9800;">密码重置验证码</h2>
            <p>您的验证码是：<strong style="font-size: 24px; color: #FF9800;">{code}</strong></p>
            <p>验证码有效期为15分钟，请尽快完成操作。</p>
            <p style="color: #999;">如果不是您本人操作，请忽略此邮件。</p>
        </body>
        </html>
        """

    return send_email(email, subject, body, purpose=purpose)
