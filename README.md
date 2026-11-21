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
| POST   | `/api/auth/register` | cria conta (se `ALLOW_SIGNUP=true`) |
| POST   | `/api/auth/login`    | retorna `access_token` + usuário   |
| GET    | `/api/auth/me`       | usuário logado (Bearer)            |

## Deploy na Vercel

1. Suba o projeto para o GitHub e importe na Vercel (Root Directory = raiz do repo).
2. Em **Storage → Marketplace**, crie um banco **Neon (Postgres)** e conecte ao projeto.
   Isso cria a variável `DATABASE_URL` automaticamente.
3. Em **Settings → Environment Variables** adicione `JWT_SECRET` (valor aleatório forte)
   e, se quiser, `ALLOW_SIGNUP=false`.
4. Crie as tabelas no banco de produção rodando localmente com a URL do Neon:
   ```bash
   DATABASE_URL="postgresql://...neon.tech/...?sslmode=require" \
   .venv/bin/python -m scripts.init_db --email voce@email.com --password suaSenha
   ```
5. Deploy. O `vercel.json` builda o front e manda `/api/*` para o FastAPI.
