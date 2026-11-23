from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.system_config import (
    CONFIG_GROUPS,
    get_group_values,
    is_secret_field,
    is_valid_group,
    save_group_values,
)
from app.models.user import User

router = APIRouter(prefix="/api/admin/system-config", tags=["System Config"])


class ConfigUpdateRequest(BaseModel):
    values: Dict[str, str]


def _require_admin(admin: User) -> None:
    if getattr(admin, "role", "user") != "admin":
        raise HTTPException(status_code=403, detail="需要管理员权限")


def _serialize_group(group: dict, db: Session) -> dict:
    values = get_group_values(group["key"], db)
    fields: List[dict] = []
    for field in group.get("fields", []):
        raw_value = values.get(field["key"], "")
        if is_secret_field(group["key"], field["key"]):
            # 密钥类字段绝不回显明文，只返回是否已配置
            fields.append({
                **field,
                "value": "",
                "configured": bool(raw_value),
            })
        else:
            fields.append({
                **field,
                "value": raw_value or field.get("default", ""),
                "configured": bool(raw_value),
            })
    return {
        "key": group["key"],
        "title": group["title"],
        "description": group.get("description", ""),
        "fields": fields,
    }


@router.get("")
def get_system_config(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_user)
):
    _require_admin(admin)
    return {"groups": [_serialize_group(group, db) for group in CONFIG_GROUPS]}


class ActiveYoloModelRequest(BaseModel):
    filename: str = ""


def _check_yolo_kind(kind: str) -> None:
    if kind not in ("plant", "pest"):
        raise HTTPException(status_code=400, detail="模型类型只能是 plant 或 pest")


def _yolo_summary(kind: str) -> dict:
    from app.core.yolo_models import (
        ALLOWED_MODEL_EXTS,
        MAX_MODEL_SIZE,
        get_active_filename,
        get_default_model_path,
        list_models,
    )
    default_path = get_default_model_path(kind)
    try:
        models = list_models(kind)
        default_exists = default_path.exists()
        active = get_active_filename(kind)
    except OSError as exc:
        # 文件系统异常不应让配置页整体报错
        print(f"[YOLO] 读取 {kind} 模型目录失败: {exc}")
        models, default_exists, active = [], False, ""
    return {
        "kind": kind,
        "active": active,
        "default_model": default_path.name,
        "default_exists": default_exists,
        "allowed_exts": sorted(ALLOWED_MODEL_EXTS),
        "max_size": MAX_MODEL_SIZE,
        "models": models,
    }


def _reload_recognition_service(kind: str) -> None:
    """启用模型后立即重新加载，失败不影响接口返回（服务内部已做异常兜底）。"""
    try:
        if kind == "plant":
            from app.services.recognition import plant_recognition_service
            plant_recognition_service.reload()
        else:
            from app.services.pest_recognition import pest_recognition_service
            pest_recognition_service.reload()
    except Exception as exc:  # pragma: no cover - 仅记录日志
        print(f"[YOLO] 重新加载 {kind} 模型失败: {exc}")


@router.get("/yolo/models")
def get_yolo_models(admin: User = Depends(get_current_user)):
    _require_admin(admin)
    return {"plant": _yolo_summary("plant"), "pest": _yolo_summary("pest")}


@router.post("/yolo/{kind}/upload")
async def upload_yolo_model(
    kind: str,
    file: UploadFile = File(...),
    admin: User = Depends(get_current_user)
):
    _require_admin(admin)
    _check_yolo_kind(kind)
    from app.core.yolo_models import save_model
    content = await file.read()
    try:
        filename = save_model(kind, file.filename or "", content)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"message": "模型上传成功", "filename": filename, "summary": _yolo_summary(kind)}


@router.delete("/yolo/{kind}/models/{filename}")
def delete_yolo_model(
    kind: str,
    filename: str,
    admin: User = Depends(get_current_user)
):
    _require_admin(admin)
    _check_yolo_kind(kind)
    from app.core.yolo_models import (
        delete_model,
        get_active_filename,
        get_default_model_path,
        usable_model_count,
    )
    active_filename = get_active_filename(kind)
    is_builtin = filename == get_default_model_path(kind).name
    if is_builtin and not active_filename:
        raise HTTPException(status_code=400, detail="默认模型正在使用中，请先启用其他模型再删除")
    if not is_builtin and filename == active_filename:
        raise HTTPException(status_code=400, detail="该模型正在使用中，请先切换其他模型再删除")
    if usable_model_count(kind) <= 1:
        raise HTTPException(status_code=400, detail="这是当前唯一可用的模型，删除后识别服务将无模型可用")
    try:
        delete_model(kind, filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="模型文件不存在")
    return {"message": "模型已删除", "summary": _yolo_summary(kind)}


@router.put("/yolo/{kind}/active")
def set_active_yolo_model(
    kind: str,
    payload: ActiveYoloModelRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_user)
):
    _require_admin(admin)
    _check_yolo_kind(kind)
    from app.core.yolo_models import get_active_filename, set_active_filename
    try:
        set_active_filename(kind, payload.filename, db)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="模型文件不存在")
    _reload_recognition_service(kind)
    return {
        "message": "已切换默认模型" if not payload.filename else "已启用该模型",
        "summary": _yolo_summary(kind),
    }


@router.put("/{group}")
def update_system_config(
    group: str,
    payload: ConfigUpdateRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_user)
):
    _require_admin(admin)
    if not is_valid_group(group):
        raise HTTPException(status_code=404, detail="配置分组不存在")

    save_group_values(group, payload.values, db)
    group_spec = next(item for item in CONFIG_GROUPS if item["key"] == group)
    return {"group": _serialize_group(group_spec, db)}
