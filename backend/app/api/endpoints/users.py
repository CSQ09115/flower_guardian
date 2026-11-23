from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import verify_password, get_password_hash, create_access_token, create_refresh_token, get_current_user, verify_refresh_token
from app.core.config import settings
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse, Token, UserUpdate, PasswordChange, PushTokenUpdate

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/register", response_model=Token)
def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    db_user = db.query(User).filter(User.email == user.email).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_password = get_password_hash(user.password)

    # 创建用户（邮箱验证已在前端完成）
    new_user = User(
        username=user.username,
        email=user.email,
        password_hash=hashed_password,
        is_email_verified=True  # 前端已验证邮箱
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # 生成 Access Token 和 Refresh Token
    access_token = create_access_token(data={"sub": new_user.username})
    refresh_token = create_refresh_token(data={"sub": new_user.username})

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    # 支持用户名或邮箱登录
    username_or_email = form_data.username
    user = db.query(User).filter(
        (User.username == username_or_email) | (User.email == username_or_email)
    ).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username/email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 检查邮箱是否已验证
    if not user.is_email_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email not verified. Please verify your email first.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    # 生成 Refresh Token
    refresh_token = create_refresh_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


class SmsCodeRequest(BaseModel):
    mobile: str
    purpose: str = "login"


class SmsLoginRequest(BaseModel):
    mobile: str
    code: str


def _validate_mobile(mobile: str) -> None:
    import re
    if not re.fullmatch(r"1[3-9]\d{9}", mobile or ""):
        raise HTTPException(status_code=400, detail="手机号格式不正确")


@router.post("/send-sms-code")
def send_sms_code(request: SmsCodeRequest, db: Session = Depends(get_db)):
    """发送短信验证码（互亿无线），用于手机号验证码登录。"""
    from app.models.sms_verification import SmsVerification
    from app.services.email_service import generate_code
    from app.services.sms_service import send_sms_code as _send_sms

    _validate_mobile(request.mobile)

    # 限频：同一手机号 60 秒内只能发送一次
    from datetime import datetime as _dt
    latest = (
        db.query(SmsVerification)
        .filter(SmsVerification.mobile == request.mobile)
        .order_by(SmsVerification.created_at.desc())
        .first()
    )
    if latest and not latest.is_expired and latest.created_at and (_dt.utcnow() - latest.created_at).total_seconds() < 60:
        raise HTTPException(status_code=429, detail="发送过于频繁，请 60 秒后再试")

    code = generate_code()
    sent, error = _send_sms(request.mobile, code, request.purpose)
    if not sent:
        # 发送失败不落库，前端可拿到真实错误（与邮件验证码逻辑一致）
        raise HTTPException(status_code=502, detail=error)

    db.add(SmsVerification.new_code(request.mobile, code, request.purpose))
    db.commit()
    return {"message": "验证码已发送", "sent": True}


@router.post("/login-by-sms", response_model=Token)
def login_by_sms(request: SmsLoginRequest, db: Session = Depends(get_db)):
    """手机号 + 短信验证码登录；首次登录自动创建账号。"""
    import secrets as _secrets
    from app.models.sms_verification import SmsVerification

    _validate_mobile(request.mobile)

    verification = (
        db.query(SmsVerification)
        .filter(
            SmsVerification.mobile == request.mobile,
            SmsVerification.code == request.code.strip(),
            SmsVerification.purpose == "login",
            SmsVerification.used == False,  # noqa: E712
        )
        .order_by(SmsVerification.created_at.desc())
        .first()
    )
    if not verification or verification.is_expired:
        raise HTTPException(status_code=401, detail="验证码错误或已过期")

    verification.used = True

    user = db.query(User).filter(User.phone == request.mobile).first()
    if not user:
        # 首次短信登录自动注册（无密码，仅可通过短信登录）
        base_suffix = request.mobile[-4:]
        username = f"sms_{base_suffix}_{_secrets.token_hex(2)}"
        while db.query(User).filter(User.username == username).first():
            username = f"sms_{base_suffix}_{_secrets.token_hex(2)}"
        user = User(
            username=username,
            email=f"{request.mobile}@sms.placeholder",
            password_hash=get_password_hash(_secrets.token_hex(32)),
            phone=request.mobile,
            is_email_verified=False,
        )
        db.add(user)

    db.commit()
    db.refresh(user)

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    refresh_token = create_refresh_token(data={"sub": user.username})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }


@router.get("/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.put("/me", response_model=UserResponse)
def update_user(
    user_update: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新用户信息"""
    if user_update.username:
        # 检查用户名是否已被占用
        existing = db.query(User).filter(
            User.username == user_update.username,
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = user_update.username

    if user_update.email:
        # 检查邮箱是否已被占用
        existing = db.query(User).filter(
            User.email == user_update.email,
            User.id != current_user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already taken")
        current_user.email = user_update.email

    if user_update.avatar_url is not None:
        current_user.avatar_url = user_update.avatar_url

    if user_update.bio is not None:
        current_user.bio = user_update.bio

    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/password")
def change_password(
    password_change: PasswordChange,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """修改密码"""
    if not verify_password(password_change.old_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect old password")

    current_user.password_hash = get_password_hash(password_change.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh-token", response_model=Token)
def refresh_token(request: RefreshRequest, db: Session = Depends(get_db)):
    """刷新 Access Token"""
    # 验证 refresh token
    username = verify_refresh_token(request.refresh_token)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token"
        )

    # 获取用户
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    # 生成新的 Access Token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username},
        expires_delta=access_token_expires
    )

    # 生成新的 Refresh Token（轮换）
    new_refresh_token = create_refresh_token(data={"sub": user.username})

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer"
    }


@router.post("/push-token")
def update_push_token(
    token_update: PushTokenUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """更新用户的 Expo 推送令牌"""
    current_user.expo_push_token = token_update.expo_push_token
    db.commit()
    return {"message": "Push token updated successfully"}


# ---------------- 邮箱绑定 / 账号合并 ----------------

SMS_PLACEHOLDER_SUFFIX = "@sms.placeholder"


class BindEmailCodeRequest(BaseModel):
    email: str


class BindEmailRequest(BaseModel):
    email: str
    code: str


def _normalize_email(email: str) -> str:
    import re
    email = (email or "").strip().lower()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=400, detail="邮箱格式不正确")
    return email


@router.post("/send-bind-email-code")
def send_bind_email_code(
    request: BindEmailCodeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """发送绑定邮箱验证码（已登录用户）。若邮箱已注册，绑定时会自动合并账号。"""
    from app.models.email_verification import EmailVerification, VerificationPurpose
    from app.services.email_service import generate_code, send_verification_email
    from datetime import datetime, timedelta

    email = _normalize_email(request.email)

    # 仅未绑定真实邮箱的账号（短信注册账号）可发起绑定
    if not (current_user.email or "").endswith(SMS_PLACEHOLDER_SUFFIX):
        raise HTTPException(status_code=400, detail="当前账号已绑定邮箱，无需重复绑定")

    code = generate_code()
    verification = EmailVerification(
        email=email,
        code=code,
        purpose=VerificationPurpose.BIND_EMAIL,
        expires_at=datetime.utcnow() + timedelta(minutes=15),
    )
    db.add(verification)
    db.commit()

    sent = send_verification_email(email, code, "bind_email")
    if not sent:
        db.delete(verification)
        db.commit()
        raise HTTPException(status_code=502, detail="邮件发送失败，请稍后重试或联系管理员检查 SMTP 配置")

    return {"message": "验证码已发送", "sent": True}


@router.post("/bind-email")
def bind_email(
    request: BindEmailRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """绑定邮箱；若该邮箱已被其他账号注册，则把旧账号数据合并进当前账号。"""
    from app.models.email_verification import EmailVerification, VerificationPurpose
    from app.services.user_merge import merge_users
    from datetime import datetime

    email = _normalize_email(request.email)

    if not (current_user.email or "").endswith(SMS_PLACEHOLDER_SUFFIX):
        raise HTTPException(status_code=400, detail="当前账号已绑定邮箱，无需重复绑定")

    verification = db.query(EmailVerification).filter(
        EmailVerification.email == email,
        EmailVerification.code == request.code.strip(),
        EmailVerification.purpose == VerificationPurpose.BIND_EMAIL,
        EmailVerification.used == 0,
        EmailVerification.expires_at > datetime.utcnow(),
    ).first()
    if not verification:
        raise HTTPException(status_code=400, detail="验证码错误或已过期")
    verification.used = 1

    existing = db.query(User).filter(User.email == email, User.id != current_user.id).first()

    if not existing:
        # 普通绑定：邮箱未被注册
        current_user.email = email
        current_user.is_email_verified = True
        db.commit()
        return {"merged": False, "message": "邮箱绑定成功"}

    # 合并：保留当前登录账号，旧邮箱账号数据并入后删除
    # 1) 采纳旧账号的登录密码（短信注册账号原本无真实密码）
    current_user.password_hash = existing.password_hash
    # 2) 继承管理员角色（如有）
    if getattr(existing, "role", "user") == "admin":
        current_user.role = "admin"
    # 3) 数据迁移
    merge_users(db, survivor=current_user, absorbed=existing)
    # 4) 更新邮箱
    current_user.email = email
    current_user.is_email_verified = True
    db.commit()

    return {
        "merged": True,
        "message": "该邮箱已有账号，数据已合并到当前账号。之后可用邮箱+原密码登录",
    }
