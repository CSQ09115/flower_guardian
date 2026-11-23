from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.core.database import get_db
from app.core.security import get_current_user, get_password_hash
from app.models.user import User
from app.models.order import Order
from app.models.address import Address
from app.models.cart import CartItem
from app.models.chat import Conversation
from app.models.device import Device
from app.models.diagnosis import DiagnosisRecord
from app.models.diary import Diary
from app.models.plant import CareRecord, GrowthRecord, HealthRecord, PlantPhoto, UserPlant
from app.models.reminder import Reminder
from app.models.weather import WeatherQuery
from app.schemas.user import UserResponse

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


def get_current_admin_user(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


class UserWithOrdersResponse:
    pass


from pydantic import BaseModel


class UserWithOrdersResponse(BaseModel):
    id: int
    username: str
    email: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    role: str
    created_at: datetime
    orders: list = []

    class Config:
        from_attributes = True


class UserListItem(BaseModel):
    id: int
    username: str
    email: str
    avatar_url: Optional[str] = None
    bio: Optional[str] = None
    role: str
    is_email_verified: Optional[bool] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    total: int
    items: list[UserListItem]


class AdminUserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: str = "user"
    bio: Optional[str] = None


@router.post("", response_model=UserResponse)
def create_user(
    payload: AdminUserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    username = payload.username.strip()
    email = str(payload.email).strip()
    if not username:
        raise HTTPException(status_code=400, detail="昵称/用户名不能为空")
    if len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="密码长度不能少于 6 位")
    if payload.role not in ("user", "admin"):
        raise HTTPException(status_code=400, detail="角色只能是 user 或 admin")

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="邮箱已被注册")
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="用户名已被占用")

    user = User(
        username=username,
        email=email,
        password_hash=get_password_hash(payload.password),
        role=payload.role,
        bio=payload.bio,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # 并发创建等极端情况下的唯一约束冲突，返回明确提示而不是 500
        db.rollback()
        raise HTTPException(status_code=400, detail="用户名或邮箱已被占用")
    db.refresh(user)
    return user


@router.get("", response_model=UserListResponse)
def list_users(
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    query = db.query(User)
    if search:
        query = query.filter(
            (User.username.contains(search)) | (User.email.contains(search))
        )
    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return {"total": total, "items": items}


@router.get("/{user_id}", response_model=UserWithOrdersResponse)
def get_user_detail(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    orders = db.query(Order).filter(Order.user_id == user_id).order_by(Order.created_at.desc()).all()

    return UserWithOrdersResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        avatar_url=user.avatar_url,
        bio=user.bio,
        role=user.role,
        created_at=user.created_at,
        orders=orders
    )


@router.get("/{user_id}/orders")
def get_user_orders(
    user_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    from app.schemas.order import OrderListResponse
    query = db.query(Order).filter(Order.user_id == user_id)
    total = query.count()
    items = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return {"total": total, "items": items}


class AdminUserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    bio: Optional[str] = None


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    payload: AdminUserUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.username is not None:
        username = payload.username.strip()
        if not username:
            raise HTTPException(status_code=400, detail="用户名不能为空")
        duplicated = db.query(User).filter(
            User.username == username, User.id != user_id
        ).first()
        if duplicated:
            raise HTTPException(status_code=400, detail="用户名已被占用")
        user.username = username

    if payload.email is not None:
        email = str(payload.email).strip()
        duplicated = db.query(User).filter(
            User.email == email, User.id != user_id
        ).first()
        if duplicated:
            raise HTTPException(status_code=400, detail="邮箱已被占用")
        user.email = email

    if payload.role is not None:
        if payload.role not in ("user", "admin"):
            raise HTTPException(status_code=400, detail="角色只能是 user 或 admin")
        user.role = payload.role

    if payload.bio is not None:
        user.bio = payload.bio

    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="不能删除当前登录的管理员账号")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 存在订单时拒绝删除，避免破坏订单/收入数据
    if db.query(Order).filter(Order.user_id == user_id).first():
        raise HTTPException(status_code=400, detail="该用户存在订单记录，无法删除")

    # 仅清理该用户自己的关联数据，避免主外键残留
    user_plant_ids = [
        row[0] for row in db.query(UserPlant.id).filter(UserPlant.user_id == user_id).all()
    ]
    if user_plant_ids:
        for model in (CareRecord, GrowthRecord, HealthRecord, PlantPhoto):
            db.query(model).filter(model.user_plant_id.in_(user_plant_ids)).delete(
                synchronize_session=False
            )
    db.query(Reminder).filter(Reminder.user_id == user_id).delete(synchronize_session=False)
    db.query(Diary).filter(Diary.user_id == user_id).delete(synchronize_session=False)
    db.query(UserPlant).filter(UserPlant.user_id == user_id).delete(synchronize_session=False)
    db.query(DiagnosisRecord).filter(DiagnosisRecord.user_id == user_id).delete(
        synchronize_session=False
    )
    for conversation in db.query(Conversation).filter(Conversation.user_id == user_id).all():
        db.delete(conversation)
    db.query(CartItem).filter(CartItem.user_id == user_id).delete(synchronize_session=False)
    db.query(Address).filter(Address.user_id == user_id).delete(synchronize_session=False)
    db.query(WeatherQuery).filter(WeatherQuery.user_id == user_id).delete(
        synchronize_session=False
    )
    db.query(Device).filter(Device.user_id == user_id).update(
        {Device.user_id: None}, synchronize_session=False
    )

    db.delete(user)
    db.commit()
    return {"message": "用户已删除"}


class BatchDeleteRequest(BaseModel):
    ids: List[int]


@router.post("/batch-delete")
def batch_delete_users(
    payload: BatchDeleteRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    if 1 in payload.ids:
        raise HTTPException(status_code=400, detail="不能删除系统管理员账号")
    if admin.id in payload.ids:
        raise HTTPException(status_code=400, detail="不能删除当前登录的管理员账号")

    deleted = 0
    for user_id in payload.ids:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            continue

        # 存在订单时拒绝删除，避免破坏订单/收入数据（与单删一致）
        if db.query(Order).filter(Order.user_id == user_id).first():
            raise HTTPException(status_code=400, detail="该用户存在订单记录，无法删除")

        # 仅清理该用户自己的关联数据，避免主外键残留（与单删一致）
        user_plant_ids = [
            row[0] for row in db.query(UserPlant.id).filter(UserPlant.user_id == user_id).all()
        ]
        if user_plant_ids:
            for model in (CareRecord, GrowthRecord, HealthRecord, PlantPhoto):
                db.query(model).filter(model.user_plant_id.in_(user_plant_ids)).delete(
                    synchronize_session=False
                )
        db.query(Reminder).filter(Reminder.user_id == user_id).delete(synchronize_session=False)
        db.query(Diary).filter(Diary.user_id == user_id).delete(synchronize_session=False)
        db.query(UserPlant).filter(UserPlant.user_id == user_id).delete(synchronize_session=False)
        db.query(DiagnosisRecord).filter(DiagnosisRecord.user_id == user_id).delete(
            synchronize_session=False
        )
        for conversation in db.query(Conversation).filter(Conversation.user_id == user_id).all():
            db.delete(conversation)
        db.query(CartItem).filter(CartItem.user_id == user_id).delete(synchronize_session=False)
        db.query(Address).filter(Address.user_id == user_id).delete(synchronize_session=False)
        db.query(WeatherQuery).filter(WeatherQuery.user_id == user_id).delete(
            synchronize_session=False
        )
        db.query(Device).filter(Device.user_id == user_id).update(
            {Device.user_id: None}, synchronize_session=False
        )

        db.delete(user)
        deleted += 1

    db.commit()
    return {"deleted": deleted}
