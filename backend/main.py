from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.routers import auth, catalog, customers, products, reports, sales, store, users

app = FastAPI(
    title="Papelaria API",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.include_router(auth.router)
app.include_router(products.router)
app.include_router(products.public_router)
app.include_router(customers.router)
app.include_router(catalog.router)
app.include_router(sales.router)
app.include_router(store.router)
app.include_router(store.public_router)
app.include_router(reports.router)
app.include_router(users.router)

# No Railway, a mesma origem serve o build do React e a API. Isso evita
# configurar CORS e mantém as chamadas /api relativas ao domínio do app.
_frontend_dir = Path(__file__).resolve().parent.parent / "frontend_dist"
_assets_dir = _frontend_dir / "assets"
if _assets_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=_assets_dir), name="frontend-assets")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/{path:path}", include_in_schema=False)
def frontend(path: str):
    # Rotas desconhecidas da API devem continuar retornando 404, não o SPA.
    if path == "api" or path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not Found")
    requested = (_frontend_dir / path).resolve()
    if path and requested.is_relative_to(_frontend_dir) and requested.is_file():
        return FileResponse(requested)
    index = _frontend_dir / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Frontend não encontrado")
