from collections import Counter
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.credit import used_this_month
from backend.models import Customer, PaymentMethod, Product, Sale, SaleItem, User
from backend.schemas import CustomerOut, SaleIn, SaleItemOut, SaleOut
from backend.security import get_current_user

router = APIRouter(prefix="/api/sales", tags=["vendas"])


def _brl(v: Decimal) -> str:
    return "R$ " + f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def customers_out_one(c: Customer | None) -> CustomerOut | None:
    return CustomerOut.model_validate(c, from_attributes=True) if c else None


def to_out(sale: Sale) -> SaleOut:
    return SaleOut(
        id=sale.id,
        created_at=sale.created_at,
        total=float(sale.total),
        payment_method=sale.payment_method.name,
        seller=sale.user.name,
        customer=customers_out_one(sale.customer),
        amount_received=float(sale.amount_received) if sale.amount_received is not None else None,
        change=float(sale.amount_received - sale.total) if sale.amount_received is not None else None,
        is_store_credit=sale.payment_method.is_store_credit,
        items=[
            SaleItemOut(
                product_id=i.product_id,
                product_name=i.product_name,
                quantity=i.quantity,
                unit_price=float(i.unit_price),
                subtotal=float(i.subtotal),
            )
            for i in sale.items
        ],
    )


@router.post("", response_model=SaleOut, status_code=status.HTTP_201_CREATED)
def create_sale(data: SaleIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    pm = db.get(PaymentMethod, data.payment_method_id)
    if pm is None or not pm.active:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Forma de pagamento inválida")
    customer = None
    if data.customer_id is not None:
        # Trava o cliente: duas vendas fiado ao mesmo tempo não estouram o limite
        customer = db.scalar(
            select(Customer).where(Customer.id == data.customer_id).with_for_update(of=Customer)
        )
        if customer is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cliente não encontrado")
    if pm.is_store_credit:
        if customer is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Fiado precisa de um cliente funcionário (informe o CPF)")
        if not customer.category.is_employee:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Fiado só para funcionários — {customer.name} é da categoria {customer.category.name}",
            )
        if not customer.credit_limit:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{customer.name} não tem limite de fiado definido")

    # Junta itens repetidos do mesmo produto
    wanted = Counter()
    for item in data.items:
        wanted[item.product_id] += item.quantity

    # FOR UPDATE trava as linhas: duas vendas ao mesmo tempo não vendem o mesmo estoque
    products = {
        p.id: p
        for p in db.scalars(
            select(Product).where(Product.id.in_(wanted)).order_by(Product.id).with_for_update()
        )
    }
    missing = [pid for pid in wanted if pid not in products]
    if missing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Produto não encontrado (id {missing[0]})")
    short = [p for pid, p in products.items() if p.quantity < wanted[pid]]
    if short:
        detail = "; ".join(f"{p.name}: tem {p.quantity}, pediu {wanted[p.id]}" for p in short)
        raise HTTPException(status.HTTP_409_CONFLICT, f"Estoque insuficiente — {detail}")

    sale = Sale(customer_id=data.customer_id, payment_method_id=pm.id, user_id=user.id, total=Decimal("0"))
    total = Decimal("0")
    for pid, qty in wanted.items():
        p = products[pid]
        subtotal = p.price * qty
        total += subtotal
        sale.items.append(
            SaleItem(product_id=p.id, product_name=p.name, quantity=qty, unit_price=p.price, subtotal=subtotal)
        )
        p.quantity -= qty
    sale.total = total
    if pm.is_store_credit:
        used = used_this_month(db, [customer.id]).get(customer.id, Decimal("0"))
        available = customer.credit_limit - used
        if total > available:
            raise HTTPException(
                status.HTTP_409_CONFLICT,
                f"Limite de fiado insuficiente: disponível {_brl(max(available, Decimal('0')))}, compra {_brl(total)}",
            )
        data.amount_received = None  # fiado não tem troco
    if data.amount_received is not None:
        if data.amount_received < total:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Valor recebido é menor que o total")
        sale.amount_received = data.amount_received

    db.add(sale)
    db.commit()
    db.refresh(sale)
    return to_out(sale)


@router.get("", response_model=list[SaleOut])
def list_sales(
    limit: int = Query(20, ge=1, le=200),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sales = db.scalars(select(Sale).order_by(Sale.id.desc()).limit(limit)).unique().all()
    return [to_out(s) for s in sales]


@router.get("/{sale_id}", response_model=SaleOut)
def get_sale(sale_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sale = db.get(Sale, sale_id)
    if sale is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Venda não encontrada")
    return to_out(sale)

