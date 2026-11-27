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
    # perfis de usuário
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'operador'",
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
    parser = argparse.ArgumentParser(
        description="Cria/atualiza as tabelas. Com --email (+ --password se for novo), cria ou promove um ADMINISTRADOR."
    )
    parser.add_argument("--email", help="e-mail do administrador")
    parser.add_argument("--name", default="Administrador")
    parser.add_argument("--password", help="senha (mín. 6 caracteres)")
    parser.add_argument("--reset-password", action="store_true",
                        help="se o e-mail já existir, troca a senha dele")
    args = parser.parse_args()

    Base.metadata.create_all(engine)
    with engine.begin() as conn:
        for sql in MIGRATIONS:
            conn.execute(text(sql))
    seed()
    print("Tabelas criadas/verificadas.")

    if args.password and not args.email:
        parser.error("--password precisa de --email")
    if args.password is not None and len(args.password) < 6:
        parser.error("a senha precisa ter pelo menos 6 caracteres")
    if args.email:
        with SessionLocal() as db:
            email = args.email.lower().strip()
            user = db.scalar(select(models.User).where(models.User.email == email))
            if user is None and not args.password:
                parser.error(f"{email} não existe: informe --password para criar o administrador")
            if user is None:
                db.add(models.User(name=args.name, email=email, role="admin", is_active=True,
                                   password_hash=hash_password(args.password)))
                print(f"Administrador {email} criado.")
            else:
                user.role = "admin"
                user.is_active = True
                msg = f"Usuário {email} já existia: agora é administrador e está ativo"
                if args.reset_password and args.password:
                    user.password_hash = hash_password(args.password)
                    msg += " (senha trocada)"
                else:
                    msg += " (senha mantida; use --reset-password para trocar)"
                print(msg + ".")
            db.commit()

    with SessionLocal() as db:
        if not db.scalar(select(models.User).where(models.User.role == "admin", models.User.is_active)):
            print("ATENÇÃO: nenhum administrador ativo. Crie um com:\n"
                  "  python -m scripts.init_db --email voce@exemplo.com --name \"Seu Nome\" --password SUA_SENHA")


if __name__ == "__main__":
    main()
