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

## Deploy no Railway

O `Dockerfile` publica o frontend React e o FastAPI no mesmo serviço, e o
PostgreSQL fica em um serviço separado do Railway. As chamadas do frontend usam
`/api` no mesmo domínio.

1. Crie um projeto no Railway e adicione um serviço PostgreSQL pelo botão **New**.
   Confirme que o PostgreSQL tem um volume persistente configurado.
2. Adicione o repositório GitHub como outro serviço do projeto. O Railway detecta
   o `Dockerfile` da raiz.
3. No serviço da aplicação, configure as variáveis:
   - `DATABASE_URL`: referência à variável `DATABASE_URL` do serviço PostgreSQL
     (por exemplo `${{Postgres.DATABASE_URL}}`, se o serviço se chamar `Postgres`).
   - `JWT_SECRET`: segredo aleatório forte, diferente das credenciais do banco.
4. Nas configurações do serviço, use `/api/health` como health check. Gere um
   domínio público e aguarde o deploy ficar saudável.
5. Inicialize o schema e crie o primeiro administrador apontando o script para
   a `DATABASE_URL` de produção:

   ```bash
   railway run --service app python -m scripts.init_db \
     --email voce@exemplo.com --name "Seu Nome" --password "SENHA_FORTE"
   ```

   Ajuste `app` para o nome do serviço da aplicação. Não coloque a senha em um
   repositório nem em arquivo versionado.

O serviço e o banco consomem recursos continuamente. Configure um limite de
gastos no Railway e mantenha backups do PostgreSQL fora da conta/serviço.

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
