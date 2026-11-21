from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.plant import Plant
from app.schemas.plant import PlantResponse
from pydantic import BaseModel


class PlantCreate(BaseModel):
    name: str
    scientific_name: Optional[str] = None
    category: Optional[str] = None
    image_url: Optional[str] = None
    yolo_class_id: Optional[int] = None
    care_level: int = 1
    beginner_friendly: Optional[int] = 3
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
    is_toxic: Optional[bool] = False
    features: Optional[List[str]] = None
    survival_rate: Optional[int] = 90


class PlantUpdate(BaseModel):
    name: Optional[str] = None
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
    features: Optional[List[str]] = None
    survival_rate: Optional[int] = None


router = APIRouter(prefix="/api/admin/plants", tags=["admin-plants"])


def get_current_admin_user(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


class PlantListResponse(BaseModel):
    total: int
    # A bare `list` cannot serialise ORM rows in Pydantic v2, and the console
    # reads image_url / light_requirement / yolo_class_id from this endpoint.
    items: List[PlantResponse]


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
