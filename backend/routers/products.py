from fastapi import APIRouter, Depends, File, HTTPException, Query, Response, UploadFile, status
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, undefer

from backend.database import get_db
from backend.images import MAX_IMAGE_BYTES, detect_mime
from backend.models import Product
from backend.schemas import ProductCreate, ProductOut, ProductUpdate
from backend.search import normalize, sql_normalize
from backend.security import get_current_user

router = APIRouter(
    prefix="/api/products",
    tags=["products"],
    dependencies=[Depends(get_current_user)],
)
# Rotas sem login: <img src> não consegue mandar o token
public_router = APIRouter(prefix="/api/products", tags=["products"])

def to_out(p: Product) -> ProductOut:
    if p.image_mime:
        image = f"/api/products/{p.id}/image?v={int(p.updated_at.timestamp())}"
    else:
        image = p.image_url
    return ProductOut(
        id=p.id, barcode=p.barcode, name=p.name, quantity=p.quantity,
        price=float(p.price), image=image, updated_at=p.updated_at,
    )


def _get_or_404(db: Session, product_id: int) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Produto não encontrado")
    return product


@router.get("", response_model=list[ProductOut])
def list_products(
    q: str | None = Query(None, description="Busca por nome ou código de barras"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
):
    stmt = select(Product).limit(limit)
    term = normalize(q or "")
    if not term:
        return [to_out(p) for p in db.scalars(stmt.order_by(Product.name))]

    name = sql_normalize(Product.name)
    barcode = func.lower(Product.barcode)
    # Cada palavra digitada precisa aparecer no nome ou no código (em qualquer ordem)
    for word in term.split():
        stmt = stmt.where(or_(name.contains(word, autoescape=True), barcode.contains(word, autoescape=True)))
    # Os que mais combinam primeiro
    rank = case(
        (barcode == term, 0),                                         # código exato
        (or_(name == term, name.startswith(term + " ", autoescape=True)), 1),  # 1ª palavra inteira
        (name.startswith(term, autoescape=True), 2),                  # nome começa com o texto
        (or_(name.contains(" " + term + " ", autoescape=True),
             name.endswith(" " + term, autoescape=True)), 3),         # palavra inteira no meio
        (name.contains(" " + term, autoescape=True), 4),              # alguma palavra começa com o texto
        (name.contains(term, autoescape=True), 5),                    # texto no meio de uma palavra
        else_=6,                                                      # palavras em outra ordem
    )
    return [to_out(p) for p in db.scalars(stmt.order_by(rank, Product.name))]


@router.get("/barcode/{barcode}", response_model=ProductOut)
def get_by_barcode(barcode: str, db: Session = Depends(get_db)):
    product = db.scalar(select(Product).where(Product.barcode == barcode.strip()))
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Produto não encontrado")
    return to_out(product)


@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(data: ProductCreate, db: Session = Depends(get_db)):
    if db.scalar(select(Product).where(Product.barcode == data.barcode)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe produto com este código de barras")
    values = data.model_dump(mode="json")
    product = Product(**values)
    db.add(product)
    db.commit()
    db.refresh(product)
    return to_out(product)


@router.put("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, data: ProductUpdate, db: Session = Depends(get_db)):
    product = _get_or_404(db, product_id)
    values = data.model_dump(mode="json", exclude_unset=True)
    if "image_url" in values:
        if values["image_url"]:  # trocar por imagem externa descarta a enviada
            product.image_data = None
            product.image_mime = None
        product.image_url = values.pop("image_url")
    for field, value in values.items():
        setattr(product, field, value)
    db.commit()
    db.refresh(product)
    return to_out(product)


@router.put("/{product_id}/image", response_model=ProductOut)
async def upload_image(product_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Imagem maior que 2 MB")
    mime = detect_mime(data)
    if mime is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Use JPG, PNG ou WEBP")
    product = _get_or_404(db, product_id)
    product.image_data = data
    product.image_mime = mime
    product.image_url = None
    db.commit()
    db.refresh(product)
    return to_out(product)


@router.delete("/{product_id}/image", response_model=ProductOut)
def delete_image(product_id: int, db: Session = Depends(get_db)):
    product = _get_or_404(db, product_id)
    product.image_data = None
    product.image_mime = None
    product.image_url = None
    db.commit()
    db.refresh(product)
    return to_out(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(product_id: int, db: Session = Depends(get_db)):
    product = _get_or_404(db, product_id)
    db.delete(product)
    db.commit()


@public_router.get("/{product_id}/image", include_in_schema=False)
def get_image(product_id: int, db: Session = Depends(get_db)):
    product = db.scalar(
        select(Product).where(Product.id == product_id).options(undefer(Product.image_data))
    )
    if product is None or not product.image_data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sem imagem")
    return Response(
        content=product.image_data,
        media_type=product.image_mime,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
