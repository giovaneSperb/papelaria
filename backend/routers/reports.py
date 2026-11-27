"""Fechamento de caixa: vendas do dia por forma de pagamento e da vendedora logada."""
from datetime import date, datetime, time, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.credit import TZ
from backend.database import get_db
from backend.models import PaymentMethod, Sale, SaleItem, User
from backend.security import get_current_user

router = APIRouter(prefix="/api/reports", tags=["relatórios"])


class PaymentTotal(BaseModel):
    payment_method_id: int
    name: str
    is_store_credit: bool
    count: int
    total: float


class Totals(BaseModel):
    count: int            # nº de vendas
    items: int            # nº de unidades vendidas
    total: float          # tudo, incluindo fiado
    received: float       # sem o fiado (o que entrou de fato)
    store_credit: float   # fiado (a descontar em folha)
    by_payment: list[PaymentTotal]


class SellerTotals(Totals):
    user_id: int
    name: str


class DailyClosing(BaseModel):
    date: date
    generated_at: datetime
    day: Totals
    seller: SellerTotals  # vendedora logada


def _day_bounds(day: date) -> tuple[datetime, datetime]:
    start = datetime.combine(day, time.min, tzinfo=TZ)
    return start, start + timedelta(days=1)


def _totals(db: Session, start: datetime, end: datetime, user_id: int | None = None) -> Totals:
    conds = [Sale.created_at >= start, Sale.created_at < end]
    if user_id is not None:
        conds.append(Sale.user_id == user_id)

    rows = db.execute(
        select(Sale.payment_method_id, func.count(Sale.id), func.coalesce(func.sum(Sale.total), 0))
        .where(*conds)
        .group_by(Sale.payment_method_id)
    ).all()
    per_method = {pm_id: (n, total) for pm_id, n, total in rows}

    items = db.scalar(
        select(func.coalesce(func.sum(SaleItem.quantity), 0)).join(Sale, Sale.id == SaleItem.sale_id).where(*conds)
    )

    # Formas ativas aparecem mesmo zeradas; inativas só se tiveram venda no dia
    methods = db.scalars(select(PaymentMethod).order_by(PaymentMethod.id)).all()
    by_payment, total, credit = [], Decimal("0"), Decimal("0")
    for pm in methods:
        n, value = per_method.get(pm.id, (0, Decimal("0")))
        if not pm.active and n == 0:
            continue
        by_payment.append(PaymentTotal(
            payment_method_id=pm.id, name=pm.name, is_store_credit=pm.is_store_credit,
            count=n, total=float(value),
        ))
        total += value
        if pm.is_store_credit:
            credit += value

    return Totals(
        count=sum(n for n, _ in per_method.values()),
        items=int(items or 0),
        total=float(total),
        received=float(total - credit),
        store_credit=float(credit),
        by_payment=by_payment,
    )


@router.get("/daily", response_model=DailyClosing)
def daily_closing(
    day: date | None = Query(None, alias="date", description="AAAA-MM-DD (padrão: hoje)"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.now(TZ)
    day = day or now.date()
    start, end = _day_bounds(day)
    mine = _totals(db, start, end, user_id=user.id)
    return DailyClosing(
        date=day,
        generated_at=now,
        day=_totals(db, start, end),
        seller=SellerTotals(user_id=user.id, name=user.name, **mine.model_dump()),
    )
