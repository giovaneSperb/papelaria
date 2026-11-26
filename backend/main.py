from fastapi import FastAPI

from backend.routers import auth, catalog, customers, products, sales, store

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


@app.get("/api/health")
def health():
    return {"status": "ok"}
