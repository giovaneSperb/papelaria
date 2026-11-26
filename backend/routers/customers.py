from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from backend.cpf import is_valid_cpf, only_digits
from backend.database import get_db
from backend.models import Customer, CustomerCategory
from backend.credit import customer_out, customers_out, month_start, used_this_month
from backend.schemas import CreditOut, CustomerIn, CustomerOut
from backend.security import get_current_user

router = APIRouter(prefix="/api/customers", tags=["clientes"], dependencies=[Depends(get_current_user)])


def _check(db: Session, data: CustomerIn, exclude_id: int | None = None) -> None:
    category = db.get(CustomerCategory, data.category_id)
    if category is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Categoria inválida")
    if not category.is_employee:
        data.credit_limit = None  # limite de fiado só vale para funcionários
    stmt = select(Customer.id).where(Customer.cpf == data.cpf)
    if exclude_id is not None:
        stmt = stmt.where(Customer.id != exclude_id)
    if db.scalar(stmt) is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe cliente com este CPF")


@router.get("", response_model=list[CustomerOut])
def list_customers(
    q: str | None = Query(None, description="Busca por nome ou CPF"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    stmt = select(Customer).order_by(Customer.name).limit(limit)
    if q and q.strip():
        term = q.strip()
        conds = [Customer.name.ilike(f"%{term}%")]
        digits = only_digits(term)
        if digits:
            conds.append(Customer.cpf.like(f"%{digits}%"))
        stmt = stmt.where(or_(*conds))
    return customers_out(db, list(db.scalars(stmt)))


@router.get("/cpf/{cpf}", response_model=CustomerOut)
def get_by_cpf(cpf: str, db: Session = Depends(get_db)):
    digits = only_digits(cpf)
    if not is_valid_cpf(digits):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "CPF inválido")
    customer = db.scalar(select(Customer).where(Customer.cpf == digits))
    if customer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado")
    return customers_out(db, [customer])[0]


@router.get("/{customer_id}/credit", response_model=CreditOut)
def get_credit(customer_id: int, db: Session = Depends(get_db)):
    """Limite de fiado do mês: quanto o funcionário ainda pode comprar."""
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado")
    if not customer.category.is_employee:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fiado só para funcionários")
    out = customer_out(customer, used_this_month(db, [customer.id]))
    return CreditOut(
        month=month_start().strftime("%Y-%m"),
        limit=out.credit_limit, used=out.credit_used, available=out.credit_available,
    )


@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
def create_customer(data: CustomerIn, db: Session = Depends(get_db)):
    _check(db, data)
    customer = Customer(**data.model_dump())
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return customers_out(db, [customer])[0]


@router.put("/{customer_id}", response_model=CustomerOut)
def update_customer(customer_id: int, data: CustomerIn, db: Session = Depends(get_db)):
    customer = db.get(Customer, customer_id)
    if customer is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cliente não encontrado")
    _check(db, data, exclude_id=customer_id)
    for field, value in data.model_dump().items():
        setattr(customer, field, value)
    db.commit()
    db.refresh(customer)
    return customers_out(db, [customer])[0]
