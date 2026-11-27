"""Dados da papelaria (cabeçalho do recibo) e logotipo."""
from pydantic import BaseModel
from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session, undefer

from backend.database import get_db
from backend.images import MAX_IMAGE_BYTES, detect_mime
from backend.models import StoreSettings
from backend.schemas import StoreIn, StoreOut
from backend.security import get_current_user, require_admin

router = APIRouter(prefix="/api/store", tags=["papelaria"], dependencies=[Depends(get_current_user)])
public_router = APIRouter(prefix="/api/store", tags=["papelaria"])


def _get(db: Session) -> StoreSettings:
    store = db.get(StoreSettings, 1)
    if store is None:  # banco ainda sem a linha padrão
        store = StoreSettings(id=1, name="Papelaria", paper_width=80)
        db.add(store)
        db.commit()
        db.refresh(store)
    return store


def to_out(s: StoreSettings) -> StoreOut:
    logo = f"/api/store/logo?v={int(s.updated_at.timestamp())}" if s.logo_mime else None
    return StoreOut(
        name=s.name, cnpj=s.cnpj, address=s.address, phone=s.phone,
        footer=s.footer, paper_width=s.paper_width, institution=s.institution, city=s.city, logo=logo,
    )


@router.get("", response_model=StoreOut)
def get_store(db: Session = Depends(get_db)):
    return to_out(_get(db))


@router.put("", response_model=StoreOut, dependencies=[Depends(require_admin)])
def update_store(data: StoreIn, db: Session = Depends(get_db)):
    store = _get(db)
    for field, value in data.model_dump().items():
        setattr(store, field, value)
    db.commit()
    db.refresh(store)
    return to_out(store)


@router.put("/logo", response_model=StoreOut, dependencies=[Depends(require_admin)])
async def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    data = await file.read(MAX_IMAGE_BYTES + 1)
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Imagem maior que 2 MB")
    mime = detect_mime(data)
    if mime is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Use JPG, PNG ou WEBP")
    store = _get(db)
    store.logo_data = data
    store.logo_mime = mime
    db.commit()
    db.refresh(store)
    return to_out(store)


@router.delete("/logo", response_model=StoreOut, dependencies=[Depends(require_admin)])
def delete_logo(db: Session = Depends(get_db)):
    store = _get(db)
    store.logo_data = None
    store.logo_mime = None
    db.commit()
    db.refresh(store)
    return to_out(store)


class BrandOut(BaseModel):
    name: str
    logo: str | None


@public_router.get("/brand", response_model=BrandOut)
def get_brand(db: Session = Depends(get_db)):
    """Público (tela de login): só o nome e o logotipo, nada além disso."""
    s = db.get(StoreSettings, 1)
    if s is None:
        return BrandOut(name="Papelaria", logo=None)
    out = to_out(s)
    return BrandOut(name=out.name, logo=out.logo)


@public_router.get("/logo", include_in_schema=False)
def get_logo(db: Session = Depends(get_db)):
    store = db.scalar(select(StoreSettings).where(StoreSettings.id == 1).options(undefer(StoreSettings.logo_data)))
    if store is None or not store.logo_data:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sem logotipo")
    return Response(
        content=store.logo_data,
        media_type=store.logo_mime,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
