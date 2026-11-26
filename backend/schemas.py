from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, HttpUrl, field_validator

from backend.cpf import is_valid_cpf, only_digits


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)  # bcrypt usa só 72 bytes


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ProductBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    quantity: int = Field(ge=0)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    # URL externa da imagem. Ao editar: omitir = não mexe; enviar = troca.
    image_url: HttpUrl | None = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nome obrigatório")
        return v


class ProductCreate(ProductBase):
    barcode: str = Field(min_length=1, max_length=64)

    @field_validator("barcode")
    @classmethod
    def strip_barcode(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Código de barras obrigatório")
        return v


class ProductUpdate(ProductBase):
    pass


class ProductOut(BaseModel):
    id: int
    barcode: str
    name: str
    quantity: int
    price: float
    image: str | None  # URL pronta para usar em <img>
    updated_at: datetime


def _clean_name(v: str) -> str:
    v = " ".join(v.split())
    if not v:
        raise ValueError("Nome obrigatório")
    return v


# ---------- categorias de cliente / formas de pagamento

class NamedIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)

    @field_validator("name")
    @classmethod
    def clean(cls, v: str) -> str:
        return _clean_name(v)


class CategoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    is_employee: bool


class CategoryUpdate(BaseModel):
    is_employee: bool


class PaymentMethodUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=60)
    active: bool | None = None

    @field_validator("name")
    @classmethod
    def clean(cls, v: str | None) -> str | None:
        return None if v is None else _clean_name(v)


class PaymentMethodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    active: bool
    is_store_credit: bool


# ---------- clientes

class CustomerIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    cpf: str
    category_id: int
    credit_limit: Decimal | None = Field(None, ge=0, max_digits=12, decimal_places=2)

    @field_validator("name")
    @classmethod
    def clean(cls, v: str) -> str:
        return _clean_name(v)

    @field_validator("cpf")
    @classmethod
    def check_cpf(cls, v: str) -> str:
        digits = only_digits(v)
        if not is_valid_cpf(digits):
            raise ValueError("CPF inválido")
        return digits


class CustomerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    cpf: str
    category: CategoryOut
    created_at: datetime
    # Fiado (só para categorias de funcionário)
    credit_limit: float | None = None
    credit_used: float | None = None       # compras fiado no mês atual
    credit_available: float | None = None


class CreditOut(BaseModel):
    month: str                             # "2026-11"
    limit: float
    used: float
    available: float


# ---------- vendas

class SaleItemIn(BaseModel):
    product_id: int
    quantity: int = Field(gt=0, le=10000)


class SaleIn(BaseModel):
    customer_id: int | None = None
    payment_method_id: int
    items: list[SaleItemIn] = Field(min_length=1, max_length=500)
    amount_received: Decimal | None = Field(None, ge=0, max_digits=12, decimal_places=2)


class SaleItemOut(BaseModel):
    product_id: int | None
    product_name: str
    quantity: int
    unit_price: float
    subtotal: float


class SaleOut(BaseModel):
    id: int
    created_at: datetime
    total: float
    payment_method: str
    seller: str
    customer: CustomerOut | None
    items: list[SaleItemOut]
    amount_received: float | None
    change: float | None
    is_store_credit: bool


# ---------- dados da papelaria (recibo)

def _blank_to_none(v: str | None) -> str | None:
    if v is None:
        return None
    v = " ".join(v.split())
    return v or None


class StoreIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    cnpj: str | None = Field(None, max_length=20)
    address: str | None = Field(None, max_length=300)
    phone: str | None = Field(None, max_length=40)
    footer: str | None = Field(None, max_length=300)
    paper_width: Literal[58, 80] = 80
    institution: str | None = Field(None, max_length=200)
    city: str | None = Field(None, max_length=120)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        return _clean_name(v)

    @field_validator("cnpj", "address", "phone", "footer", "institution", "city")
    @classmethod
    def clean_optional(cls, v: str | None) -> str | None:
        return _blank_to_none(v)


class StoreOut(BaseModel):
    name: str
    cnpj: str | None
    address: str | None
    phone: str | None
    footer: str | None
    paper_width: int
    institution: str | None
    city: str | None
    logo: str | None  # URL pronta para <img>

