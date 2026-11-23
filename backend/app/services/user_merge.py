"""用户账号合并服务。

场景：手机验证码注册的账号在绑定邮箱时，若该邮箱已被其他账号注册，
则把旧邮箱账号的数据全部迁移到当前登录账号下并删除旧账号。
"""
from sqlalchemy.orm import Session

from app.models.address import Address
from app.models.cart import CartItem
from app.models.chat import Conversation
from app.models.device import Device
from app.models.diagnosis import DiagnosisRecord
from app.models.diary import Diary
from app.models.order import Order
from app.models.plant import UserPlant
from app.models.reminder import Reminder
from app.models.user import User
from app.models.weather import WeatherQuery


def _reassign(db: Session, model, source_id: int, target_id: int) -> int:
    """把某张表中属于 source 用户的记录批量改挂到 target 用户名下。"""
    count = (
        db.query(model)
        .filter(model.user_id == source_id)
        .update({model.user_id: target_id}, synchronize_session=False)
    )
    return count or 0


def merge_users(db: Session, survivor: User, absorbed: User) -> dict:
    """把 absorbed 账号的数据合并进 survivor 账号，最后删除 absorbed。

    - 购物车按商品去重（同商品数量累加）
    - 若 absorbed 是管理员，则 survivor 继承管理员角色
    - 不迁移用户名/邮箱等账号字段，由调用方处理
    """
    moved = {}

    # 购物车：同商品合并数量，避免重复条目
    survivor_cart = {
        item.product_id: item for item in db.query(CartItem).filter(CartItem.user_id == survivor.id).all()
    }
    absorbed_items = db.query(CartItem).filter(CartItem.user_id == absorbed.id).all()
    cart_merged = 0
    for item in absorbed_items:
        existing = survivor_cart.get(item.product_id)
        if existing:
            existing.quantity += item.quantity
            db.delete(item)
        else:
            item.user_id = survivor.id
            survivor_cart[item.product_id] = item
        cart_merged += 1
    moved["cart_items"] = cart_merged

    for model in (Order, Address, UserPlant, Reminder, Diary,
                  Conversation, DiagnosisRecord, Device, WeatherQuery):
        moved[model.__tablename__] = _reassign(db, model, absorbed.id, survivor.id)

    if getattr(absorbed, "role", "user") == "admin" and survivor.role != "admin":
        survivor.role = "admin"

    db.delete(absorbed)
    db.flush()
    return moved
