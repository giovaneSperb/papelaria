from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, LargeBinary, Numeric, String, Text, func, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    # "admin": gerencia usuários e configurações | "operador": vende, estoque, clientes, caixa
    role: Mapped[str] = mapped_column(String(20), default="operador", server_default="operador")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    barcode: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[int] = mapped_column(Integer, default=0)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    # Imagem externa (ex.: achada na internet pelo código EAN)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Imagem enviada pelo usuário, guardada no próprio banco (carregada só quando pedida)
    image_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True, deferred=True)
    image_mime: Mapped[str | None] = mapped_column(String(32), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class CustomerCategory(Base):
    __tablename__ = "customer_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)
    # Clientes desta categoria podem comprar fiado (desconto em folha)
    is_employee: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    cpf: Mapped[str] = mapped_column(String(11), unique=True, index=True)  # só dígitos
    category_id: Mapped[int] = mapped_column(ForeignKey("customer_categories.id"))
    # Limite mensal para compras no fiado (só para categorias com is_employee)
    credit_limit: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    category: Mapped[CustomerCategory] = relationship(lazy="joined")


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)
    # Desativar em vez de apagar: vendas antigas continuam apontando para ela
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    # Fiado: só para clientes funcionários, dentro do limite mensal
    is_store_credit: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(primary_key=True)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"), nullable=True)
    payment_method_id: Mapped[int] = mapped_column(ForeignKey("payment_methods.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Valor entregue pelo cliente (pagamento em dinheiro), para calcular o troco no recibo
    amount_received: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    customer: Mapped[Customer | None] = relationship(lazy="joined")
    payment_method: Mapped[PaymentMethod] = relationship(lazy="joined")
    user: Mapped[User] = relationship(lazy="joined")
    items: Mapped[list["SaleItem"]] = relationship(
        back_populates="sale", cascade="all, delete-orphan", lazy="selectin", order_by="SaleItem.id"
    )


class SaleItem(Base):
    __tablename__ = "sale_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id", ondelete="CASCADE"), index=True)
    # SET NULL: se o produto for excluído, o histórico da venda continua
    product_id: Mapped[int | None] = mapped_column(
        ForeignKey("products.id", ondelete="SET NULL"), nullable=True
    )
    # Cópia do nome e preço no momento da venda
    product_name: Mapped[str] = mapped_column(String(200))
    quantity: Mapped[int] = mapped_column(Integer)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))

    sale: Mapped[Sale] = relationship(back_populates="items")


class StoreSettings(Base):
    """Dados da papelaria para o cabeçalho do recibo. Sempre uma linha só (id = 1)."""

    __tablename__ = "store_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), default="Papelaria")
    cnpj: Mapped[str | None] = mapped_column(String(20), nullable=True)
    address: Mapped[str | None] = mapped_column(String(300), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(40), nullable=True)
    footer: Mapped[str | None] = mapped_column(String(300), nullable=True)
    paper_width: Mapped[int] = mapped_column(Integer, default=80)  # 80 ou 58 (mm)
    # Termo de autorização de desconto em folha (fiado)
    institution: Mapped[str | None] = mapped_column(String(200), nullable=True)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    logo_data: Mapped[bytes | None] = mapped_column(LargeBinary, nullable=True, deferred=True)
    logo_mime: Mapped[str | None] = mapped_column(String(32), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

