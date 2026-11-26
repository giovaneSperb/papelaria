"""Fiado: quanto cada funcionário já usou do limite no mês atual."""
from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.models import Customer, PaymentMethod, Sale
from backend.schemas import CategoryOut, CustomerOut

TZ = ZoneInfo("America/Sao_Paulo")


def month_start(now: datetime | None = None) -> datetime:
    """1º dia do mês atual, 00:00 no horário de Brasília."""
    local = (now or datetime.now(TZ)).astimezone(TZ)
    return local.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def used_this_month(db: Session, customer_ids: list[int]) -> dict[int, Decimal]:
    if not customer_ids:
        return {}
    rows = db.execute(
        select(Sale.customer_id, func.sum(Sale.total))
        .join(PaymentMethod, PaymentMethod.id == Sale.payment_method_id)
        .where(
            PaymentMethod.is_store_credit.is_(True),
            Sale.customer_id.in_(customer_ids),
            Sale.created_at >= month_start(),
        )
        .group_by(Sale.customer_id)
    )
    return {cid: total for cid, total in rows}


def customer_out(c: Customer, used: dict[int, Decimal]) -> CustomerOut:
    out = CustomerOut(
        id=c.id, name=c.name, cpf=c.cpf, created_at=c.created_at,
        category=CategoryOut.model_validate(c.category),
    )
    if c.category.is_employee:
        limit = c.credit_limit or Decimal("0")
        spent = used.get(c.id, Decimal("0"))
        out.credit_limit = float(limit)
        out.credit_used = float(spent)
        out.credit_available = float(max(limit - spent, Decimal("0")))
    return out


def customers_out(db: Session, customers: list[Customer]) -> list[CustomerOut]:
    used = used_this_month(db, [c.id for c in customers if c.category.is_employee])
    return [customer_out(c, used) for c in customers]
