"""Usuários do sistema: só administradores criam e gerenciam operadores."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import User
from backend.schemas import UserCreate, UserOut, UserUpdate
from backend.security import hash_password, require_admin

router = APIRouter(prefix="/api/users", tags=["usuários"], dependencies=[Depends(require_admin)])


def _active_admins(db: Session) -> int:
    return db.scalar(select(func.count(User.id)).where(User.role == "admin", User.is_active.is_(True)))


@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.is_active.desc(), User.name)).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    email = data.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Já existe usuário com este e-mail")
    user = User(name=data.name, email=email, role=data.role, is_active=True,
                password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    data: UserUpdate,
    me: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    # Trava a tabela de admins para duas alterações simultâneas não deixarem o sistema sem admin
    user = db.scalar(select(User).where(User.id == user_id).with_for_update())
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado")

    if user.id == me.id and data.is_active is False:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Você não pode desativar a si mesmo")

    loses_admin = user.role == "admin" and user.is_active and (
        (data.role is not None and data.role != "admin") or data.is_active is False
    )
    if loses_admin:
        db.execute(select(User.id).where(User.role == "admin").with_for_update())
        if _active_admins(db) <= 1:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "É preciso manter pelo menos um administrador ativo")

    if data.name is not None:
        user.name = data.name
    if data.role is not None:
        user.role = data.role
    if data.is_active is not None:
        user.is_active = data.is_active
    if data.password is not None:
        user.password_hash = hash_password(data.password)
    db.commit()
    db.refresh(user)
    return user
