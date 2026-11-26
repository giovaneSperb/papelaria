"""Cadastros auxiliares: categorias de cliente e formas de pagamento."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import CustomerCategory, PaymentMethod
from backend.schemas import CategoryOut, CategoryUpdate, NamedIn, PaymentMethodOut, PaymentMethodUpdate
from backend.security import get_current_user

router = APIRouter(prefix="/api", tags=["cadastros"], dependencies=[Depends(get_current_user)])


def _name_taken(db: Session, model, name: str, exclude_id: int | None = None) -> bool:
    stmt = select(model.id).where(func.lower(model.name) == name.lower())
    if exclude_id is not None:
        stmt = stmt.where(model.id != exclude_id)
    return db.scalar(stmt) is not None


# ---------- categorias de cliente

@router.get("/customer-categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(CustomerCategory).order_by(CustomerCategory.name)).all()


@router.post("/customer-categories", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(data: NamedIn, db: Session = Depends(get_db)):
    if _name_taken(db, CustomerCategory, data.name):
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe uma categoria com esse nome")
    cat = CustomerCategory(name=data.name)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.patch("/customer-categories/{cat_id}", response_model=CategoryOut)
def update_category(cat_id: int, data: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.get(CustomerCategory, cat_id)
    if cat is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoria não encontrada")
    cat.is_employee = data.is_employee
    db.commit()
    db.refresh(cat)
    return cat


# ---------- formas de pagamento

@router.get("/payment-methods", response_model=list[PaymentMethodOut])
def list_payment_methods(
    include_inactive: bool = Query(False), db: Session = Depends(get_db)
):
    stmt = select(PaymentMethod).order_by(PaymentMethod.id)
    if not include_inactive:
        stmt = stmt.where(PaymentMethod.active.is_(True))
    return db.scalars(stmt).all()


@router.post("/payment-methods", response_model=PaymentMethodOut, status_code=status.HTTP_201_CREATED)
def create_payment_method(data: NamedIn, db: Session = Depends(get_db)):
    if _name_taken(db, PaymentMethod, data.name):
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe uma forma de pagamento com esse nome")
    pm = PaymentMethod(name=data.name, active=True)
    db.add(pm)
    db.commit()
    db.refresh(pm)
    return pm


@router.patch("/payment-methods/{pm_id}", response_model=PaymentMethodOut)
def update_payment_method(pm_id: int, data: PaymentMethodUpdate, db: Session = Depends(get_db)):
    pm = db.get(PaymentMethod, pm_id)
    if pm is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Forma de pagamento não encontrada")
    if data.name is not None:
        if _name_taken(db, PaymentMethod, data.name, exclude_id=pm_id):
            raise HTTPException(status.HTTP_409_CONFLICT, "Já existe uma forma de pagamento com esse nome")
        pm.name = data.name
    if data.active is not None:
        pm.active = data.active
    db.commit()
    db.refresh(pm)
    return pm
