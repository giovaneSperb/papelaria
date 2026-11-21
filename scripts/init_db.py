"""Cria as tabelas e, opcionalmente, um usuário.

Uso:
    python -m scripts.init_db
    python -m scripts.init_db --email admin@papelaria.com --name Admin --password segredo123
"""
import argparse

from sqlalchemy import select

from backend import models  # noqa: F401  (registra os modelos no metadata)
from backend.database import Base, SessionLocal, engine
from backend.security import hash_password


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email")
    parser.add_argument("--name", default="Administrador")
    parser.add_argument("--password")
    args = parser.parse_args()

    Base.metadata.create_all(engine)
    print("Tabelas criadas/verificadas.")

    if args.email and args.password:
        with SessionLocal() as db:
            email = args.email.lower()
            if db.scalar(select(models.User).where(models.User.email == email)):
                print(f"Usuário {email} já existe.")
                return
            db.add(models.User(name=args.name, email=email, password_hash=hash_password(args.password)))
            db.commit()
            print(f"Usuário {email} criado.")


if __name__ == "__main__":
    main()
