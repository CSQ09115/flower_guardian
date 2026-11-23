from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import Any, List, Optional
from datetime import datetime
from pathlib import Path
from uuid import uuid4
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.plant import Plant
from pydantic import BaseModel

# 植物图片落盘目录（与 /static 挂载目录一致），新图使用独立文件名，不影响老图路径
STATIC_PLANTS_DIR = Path(__file__).resolve().parents[3] / "static" / "plants"
ALLOWED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGE_SIZE = 5 * 1024 * 1024  # 5MB


class PlantCreate(BaseModel):
    name: str
    scientific_name: Optional[str] = None
    category: Optional[str] = None
    care_level: int = 1
    description: Optional[str] = None
    light_requirement: Optional[str] = None
    water_requirement: Optional[str] = None
    temperature_range: Optional[str] = None
    humidity_range: Optional[str] = None
    fertilization: Optional[str] = None
    repotting: Optional[str] = None
    common_mistakes: Optional[str] = None
    tips: Optional[str] = None
    # 以下字段数据库列已存在，补齐 schema 让管理台表单可完整保存
    watering_tip: Optional[str] = None
    image_url: Optional[str] = None
    yolo_class_id: Optional[int] = None
    is_toxic: Optional[bool] = None
    beginner_friendly: Optional[int] = None
    survival_rate: Optional[int] = None
    features: Optional[Any] = None


class PlantUpdate(BaseModel):
    name: Optional[str] = None
    scientific_name: Optional[str] = None
    category: Optional[str] = None
    care_level: Optional[int] = None
    description: Optional[str] = None
    light_requirement: Optional[str] = None
    water_requirement: Optional[str] = None
    temperature_range: Optional[str] = None
    humidity_range: Optional[str] = None
    fertilization: Optional[str] = None
    repotting: Optional[str] = None
    common_mistakes: Optional[str] = None
    tips: Optional[str] = None
    watering_tip: Optional[str] = None
    image_url: Optional[str] = None
    yolo_class_id: Optional[int] = None
    is_toxic: Optional[bool] = None
    beginner_friendly: Optional[int] = None
    survival_rate: Optional[int] = None
    features: Optional[Any] = None


router = APIRouter(prefix="/api/admin/plants", tags=["admin-plants"])


def get_current_admin_user(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


class PlantResponse(BaseModel):
    id: int
    name: str
    scientific_name: Optional[str] = None
    category: Optional[str] = None
    care_level: int
    description: Optional[str] = None

    class Config:
        from_attributes = True


class PlantListItem(BaseModel):
    id: int
    name: str
    scientific_name: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    yolo_class_id: Optional[int] = None
    care_level: Optional[int] = None
    beginner_friendly: Optional[int] = None
    description: Optional[str] = None
    light_requirement: Optional[str] = None
    water_requirement: Optional[str] = None
    watering_tip: Optional[str] = None
    temperature_range: Optional[str] = None
    humidity_range: Optional[str] = None
    fertilization: Optional[str] = None
    repotting: Optional[str] = None
    common_mistakes: Optional[str] = None
    tips: Optional[str] = None
    is_toxic: Optional[bool] = None
    features: Optional[Any] = None
    survival_rate: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PlantListResponse(BaseModel):
    total: int
    items: list[PlantListItem]


@router.get("", response_model=PlantListResponse)
def list_plants(
    category: Optional[str] = None,
    care_level: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    query = db.query(Plant)
    if category:
        query = query.filter(Plant.category == category)
    if care_level:
        query = query.filter(Plant.care_level == care_level)
    if search:
        query = query.filter(Plant.name.contains(search))

    total = query.count()
    items = query.offset(skip).limit(limit).all()
    return {"total": total, "items": items}


@router.post("", response_model=PlantResponse)
def create_plant(
    plant: PlantCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    new_plant = Plant(**plant.model_dump())
    db.add(new_plant)
    db.commit()
    db.refresh(new_plant)
    return new_plant


@router.post("/{plant_id}/image", response_model=PlantListItem)
async def upload_plant_image(
    plant_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        raise HTTPException(status_code=400, detail="仅支持 jpg / jpeg / png / webp 格式图片")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="图片内容不能为空")
    if len(content) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="图片大小不能超过 5MB")

    STATIC_PLANTS_DIR.mkdir(parents=True, exist_ok=True)
    filename = f"plant_{plant_id}_{uuid4().hex[:8]}{ext}"
    (STATIC_PLANTS_DIR / filename).write_bytes(content)

    # 只更新数据库指向，旧文件保留，App 端原有 /static/plants/* 路径不受影响
    plant.image_url = f"/static/plants/{filename}"
    db.commit()
    db.refresh(plant)
    return plant


@router.get("/{plant_id}", response_model=PlantResponse)
def get_plant(
    plant_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant


@router.put("/{plant_id}", response_model=PlantResponse)
def update_plant(
    plant_id: int,
    plant_update: PlantUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    update_data = plant_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plant, field, value)

    db.commit()
    db.refresh(plant)
    return plant


@router.delete("/{plant_id}")
def delete_plant(
    plant_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    db.delete(plant)
    db.commit()
    return {"message": "Plant deleted successfully"}


class BatchDeleteRequest(BaseModel):
    ids: List[int]


@router.post("/batch-delete")
def batch_delete_plants(
    payload: BatchDeleteRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    deleted = 0
    for plant_id in payload.ids:
        plant = db.query(Plant).filter(Plant.id == plant_id).first()
        if not plant:
            continue
        # 与单删逻辑一致，仅删除数据库记录，不动本地图片文件
        db.delete(plant)
        deleted += 1
    db.commit()
    return {"deleted": deleted}
