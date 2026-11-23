from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.email_log import EmailSendLog
from app.models.user import User

router = APIRouter(prefix="/api/admin/email-logs", tags=["Email Logs"])


def _require_admin(admin: User) -> None:
    if getattr(admin, "role", "user") != "admin":
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="需要管理员权限")


@router.delete("/failed")
def delete_failed_logs(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    """清除所有「失败」状态的邮件发送日志（历史失败记录排查完毕后可清理）"""
    _require_admin(admin)
    deleted = db.query(EmailSendLog).filter(EmailSendLog.status == "failed").delete(synchronize_session=False)
    db.commit()
    return {"deleted": deleted}


@router.get("")
def list_email_logs(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    status: str = Query("", description="按状态筛选：success / failed，留空返回全部"),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_user),
):
    """邮件发送日志列表（倒序分页）"""
    _require_admin(admin)

    query = db.query(EmailSendLog)
    if status in ("success", "failed"):
        query = query.filter(EmailSendLog.status == status)

    total = query.count()
    success_count = db.query(EmailSendLog).filter(EmailSendLog.status == "success").count()
    failed_count = db.query(EmailSendLog).filter(EmailSendLog.status == "failed").count()
    logs = (
        query.order_by(EmailSendLog.created_at.desc(), EmailSendLog.id.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "size": size,
        "success_count": success_count,
        "failed_count": failed_count,
        "items": [
            {
                "id": log.id,
                "recipient": log.recipient,
                "subject": log.subject,
                "purpose": log.purpose,
                "status": log.status,
                "error": log.error or "",
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
    }
