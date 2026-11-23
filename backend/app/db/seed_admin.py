"""管理员账号初始化：仅在账号不存在时创建默认管理员。

已存在的账号不会被重置密码，避免生产环境重启后密码被改回默认值；
如需重置，请通过登录后的修改密码接口或数据库操作完成。
"""
import logging

from app.core.database import SessionLocal
from app.core.security import get_password_hash
from app.models.user import User

ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@example.com"
ADMIN_DEFAULT_PASSWORD = "123456"


def seed_admin_user(db) -> None:
    """确保 admin 账号存在；已存在时不做任何修改。"""
    admin = db.query(User).filter(User.username == ADMIN_USERNAME).first()
    if admin is not None:
        return

    db.add(User(
        username=ADMIN_USERNAME,
        email=ADMIN_EMAIL,
        password_hash=get_password_hash(ADMIN_DEFAULT_PASSWORD),
        role="admin",
        is_email_verified=True,
    ))
    db.commit()
    logging.info("已创建管理员账号 %s", ADMIN_USERNAME)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    db = SessionLocal()
    try:
        seed_admin_user(db)
    finally:
        db.close()
