"""YOLO 模型文件管理与启用配置。

上传的模型存放在 backend/models/uploads/{plant|pest}/ 下，
启用的文件名写入 system_configs（yolo.plant_model / yolo.pest_model），
未配置或文件缺失时由识别服务回退到 backend/models 下的默认模型。
"""
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

from app.core.database import SessionLocal
from app.core.system_config import get_config_value
from app.models.system_config import SystemConfig

BACKEND_DIR = Path(__file__).resolve().parents[2]
MODELS_DIR = BACKEND_DIR / "models"
UPLOAD_ROOT = MODELS_DIR / "uploads"
DEFAULT_MODELS = {
    "plant": MODELS_DIR / "plant.pt",
    "pest": MODELS_DIR / "pest.pt",
}
ALLOWED_MODEL_EXTS = {".pt", ".onnx"}
MAX_MODEL_SIZE = 200 * 1024 * 1024  # 200MB

logger = logging.getLogger(__name__)


def _kind_dir(kind: str) -> Path:
    return UPLOAD_ROOT / kind


def _config_key(kind: str) -> str:
    return f"yolo.{kind}_model"


def _safe_name(filename: str) -> str:
    return Path(filename or "").name


def get_default_model_path(kind: str) -> Path:
    return DEFAULT_MODELS[kind]


def get_active_filename(kind: str) -> str:
    """返回已启用的上传模型文件名；未配置或文件不存在时返回空串（走默认模型）。"""
    filename = get_config_value("yolo", f"{kind}_model", "") or ""
    if not filename:
        return ""
    if not (_kind_dir(kind) / _safe_name(filename)).exists():
        logger.warning("YOLO 模型 %s 配置的文件不存在，回退默认模型: %s", kind, filename)
        return ""
    return _safe_name(filename)


def resolve_active_path(kind: str) -> Optional[Path]:
    """解析当前启用模型路径；未启用上传模型时返回 None。"""
    filename = get_active_filename(kind)
    if not filename:
        return None
    return _kind_dir(kind) / filename


def list_models(kind: str) -> List[Dict]:
    """列出内置默认模型 + 上传模型，默认模型排在最前。"""
    active = get_active_filename(kind)
    items = []

    default_path = DEFAULT_MODELS[kind]
    if default_path.exists():
        stat = default_path.stat()
        items.append({
            "filename": default_path.name,
            "size": stat.st_size,
            "uploaded_at": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
            "active": not active,
            "builtin": True,
        })

    folder = _kind_dir(kind)
    if folder.exists():
        for file in sorted(folder.glob("*"), key=lambda p: p.stat().st_mtime, reverse=True):
            if not file.is_file() or file.suffix.lower() not in ALLOWED_MODEL_EXTS:
                continue
            stat = file.stat()
            items.append({
                "filename": file.name,
                "size": stat.st_size,
                "uploaded_at": datetime.fromtimestamp(stat.st_mtime).isoformat(timespec="seconds"),
                "active": file.name == active,
                "builtin": False,
            })
    return items


def usable_model_count(kind: str) -> int:
    """当前可用的模型数量（内置默认模型 + 上传模型）。"""
    count = 1 if DEFAULT_MODELS[kind].exists() else 0
    folder = _kind_dir(kind)
    if folder.exists():
        count += sum(
            1 for file in folder.glob("*")
            if file.is_file() and file.suffix.lower() in ALLOWED_MODEL_EXTS
        )
    return count


def save_model(kind: str, filename: str, content: bytes) -> str:
    """保存上传的模型文件，返回实际落盘的文件名。"""
    ext = Path(filename or "").suffix.lower()
    if ext not in ALLOWED_MODEL_EXTS:
        raise ValueError("仅支持 .pt / .onnx 模型文件")
    if not content:
        raise ValueError("模型文件内容不能为空")
    if len(content) > MAX_MODEL_SIZE:
        raise ValueError("模型文件不能超过 200MB")

    folder = _kind_dir(kind)
    folder.mkdir(parents=True, exist_ok=True)
    stem = Path(_safe_name(filename)).stem or "model"
    safe_stem = "".join(ch for ch in stem if ch.isalnum() or ch in ("-", "_")) or "model"
    target_name = f"{safe_stem}_{datetime.now().strftime('%Y%m%d%H%M%S')}{ext}"
    (folder / target_name).write_bytes(content)
    return target_name


def delete_model(kind: str, filename: str) -> None:
    """删除模型文件；内置默认模型也允许删除（由接口层做使用中/唯一可用保护）。"""
    name = _safe_name(filename)
    if name == DEFAULT_MODELS[kind].name:
        path = DEFAULT_MODELS[kind]
    else:
        path = _kind_dir(kind) / name
    if not path.exists():
        raise FileNotFoundError("模型文件不存在")
    path.unlink()


def set_active_filename(kind: str, filename: str, db=None) -> None:
    """设置启用的模型文件名；传空串或内置默认模型名表示使用默认模型。"""
    value = _safe_name(filename) if filename else ""
    if value == DEFAULT_MODELS[kind].name:
        if not DEFAULT_MODELS[kind].exists():
            raise FileNotFoundError("默认模型文件不存在")
        value = ""
    elif value and not (_kind_dir(kind) / value).exists():
        raise FileNotFoundError("模型文件不存在")

    own_session = db is None
    session = db or SessionLocal()
    try:
        key = _config_key(kind)
        row = session.query(SystemConfig).filter(SystemConfig.key == key).first()
        if row:
            row.value = value
        else:
            session.add(SystemConfig(key=key, value=value))
        session.commit()
    finally:
        if own_session:
            session.close()
