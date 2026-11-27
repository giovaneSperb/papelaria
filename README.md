# Papelaria

- **Backend:** FastAPI + SQLAlchemy + PostgreSQL (`backend/`, entrada Vercel em `api/index.py`)
- **Frontend:** React + Vite (`frontend/`)
- **Auth:** senha com bcrypt, token JWT (Bearer)

## Rodando local

```bash
# 1. Banco
docker compose up -d

# 2. Backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env            # ajuste JWT_SECRET
.venv/bin/python -m scripts.init_db --email admin@papelaria.com --password admin123
.venv/bin/uvicorn api.index:app --reload --port 8010

# 3. Frontend (outro terminal)
cd frontend && npm install && npm run dev
```

Abra http://localhost:5173 — a documentação da API fica em http://localhost:8010/api/docs.

## Endpoints

| Método | Rota                 | Descrição                          |
|--------|----------------------|------------------------------------|
| GET    | `/api/health`        | status                             |
| POST   | `/api/auth/login`    | retorna `access_token` + usuário   |
| GET    | `/api/auth/me`       | usuário logado (Bearer)            |
| GET    | `/api/products`      | lista/busca (`?q=`)                |
| GET    | `/api/products/barcode/{codigo}` | produto do estoque pelo código |
| POST   | `/api/products`      | cadastra                           |
| PUT    | `/api/products/{id}` | edita                              |
| PUT    | `/api/products/{id}/image` | envia foto (multipart, até 2 MB) |
| DELETE | `/api/products/{id}/image` | remove a imagem              |
| GET    | `/api/products/{id}/image` | foto enviada (pública)       |

## Imagens dos produtos

- **Pelo Google (manual):** os botões "Google: nome" e "Google: código" abrem o Google Imagens.
  Copie a imagem e cole no campo do cadastro (Ctrl+V); ela é salva no banco.
- **Foto própria:** botão "Enviar foto" (câmera ou galeria).

## Mudanças no banco

`scripts/init_db.py` cria tabelas novas e aplica a lista `MIGRATIONS`. Rode de novo
sempre que o modelo mudar (local e no banco da Vercel); é seguro repetir.

## Deploy na Vercel

1. Suba o projeto para o GitHub e importe na Vercel (Root Directory = raiz do repo).
2. Em **Storage → Marketplace**, crie um banco **Neon (Postgres)** e conecte ao projeto.
   Isso cria a variável `DATABASE_URL` automaticamente.
3. Em **Settings → Environment Variables** adicione `JWT_SECRET` (valor aleatório forte)
4. Crie as tabelas no banco de produção rodando localmente com a URL do Neon:
   ```bash
   DATABASE_URL="postgresql://...neon.tech/...?sslmode=require" \
   .venv/bin/python -m scripts.init_db --email voce@email.com --password suaSenha
   ```
5. Deploy. O `vercel.json` builda o front e manda `/api/*` para o FastAPI.

## Usuários e perfis

Não existe autocadastro. Perfis:

- **Administrador(a)**: tudo, inclusive a tela **Usuários** (cadastrar, trocar senha, desativar)
  e **Configurações**.
- **Operador(a)**: Venda, Estoque, Clientes e Caixa.

O **primeiro administrador** é criado (ou um usuário existente é promovido) pelo terminal,
apontando para o banco desejado:

```bash
# novo administrador
.venv/bin/python -m scripts.init_db --email voce@exemplo.com --name "Seu Nome" --password SUA_SENHA
# promover um usuário que já existe (mantém a senha)
.venv/bin/python -m scripts.init_db --email usuario@exemplo.com
# esqueceu a senha do administrador
.venv/bin/python -m scripts.init_db --email voce@exemplo.com --password NOVA_SENHA --reset-password
```

O sistema sempre mantém pelo menos um administrador ativo, e ninguém desativa a si mesmo.
