"""Cria as tabelas e, opcionalmente, um usuário.

Uso:
    python -m scripts.init_db
    python -m scripts.init_db --email admin@papelaria.com --name Admin --password segredo123
"""
import argparse

from sqlalchemy import select, text

from backend import models  # noqa: F401  (registra os modelos no metadata)
from backend.database import Base, SessionLocal, engine
from backend.security import hash_password


# Alterações em tabelas que já existem (create_all só cria tabelas novas).
# Cada comando precisa ser seguro para rodar várias vezes.
MIGRATIONS = [
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS image_data BYTEA",
    "ALTER TABLE products ADD COLUMN IF NOT EXISTS image_mime VARCHAR(32)",
    "ALTER TABLE sales ADD COLUMN IF NOT EXISTS amount_received NUMERIC(12, 2)",
    # fiado
    "ALTER TABLE customer_categories ADD COLUMN IF NOT EXISTS is_employee BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE payment_methods ADD COLUMN IF NOT EXISTS is_store_credit BOOLEAN NOT NULL DEFAULT false",
    "ALTER TABLE customers ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12, 2)",
    "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS institution VARCHAR(200) DEFAULT 'Colégio Luterano da Paz'",
    "ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS city VARCHAR(120)",
]


# Dados iniciais: só inseridos se ainda não existirem
DEFAULT_CATEGORIES = ["Cliente", "Funcionário"]
DEFAULT_PAYMENT_METHODS = ["Pix", "Dinheiro", "Crédito", "Débito"]


def seed() -> None:
    with SessionLocal() as db:
        for model, names in (
            (models.CustomerCategory, DEFAULT_CATEGORIES),
            (models.PaymentMethod, DEFAULT_PAYMENT_METHODS),
        ):
            existing = set(db.scalars(select(model.name)))
            for name in names:
                if name not in existing:
                    db.add(model(name=name))
        # Fiado: forma de pagamento própria e categoria "Funcionário" autorizada
        if not db.scalar(select(models.PaymentMethod).where(models.PaymentMethod.is_store_credit)):
            fiado = db.scalar(select(models.PaymentMethod).where(models.PaymentMethod.name == "Fiado"))
            if fiado is None:
                db.add(models.PaymentMethod(name="Fiado", active=True, is_store_credit=True))
            else:
                fiado.is_store_credit = True
        if not db.scalar(select(models.CustomerCategory).where(models.CustomerCategory.is_employee)):
            func_cat = db.scalar(select(models.CustomerCategory).where(models.CustomerCategory.name == "Funcionário"))
            if func_cat is not None:
                func_cat.is_employee = True
        if db.get(models.StoreSettings, 1) is None:
            db.add(models.StoreSettings(id=1, name="Papelaria", paper_width=80,
                                        footer="Obrigado pela preferência!",
                                        institution="Colégio Luterano da Paz"))
        db.commit()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--email")
    parser.add_argument("--name", default="Administrador")
    parser.add_argument("--password")
    args = parser.parse_args()

    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        for sql in MIGRATIONS:
            conn.execute(text(sql))
    seed()
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
