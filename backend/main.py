from fastapi import FastAPI

from backend.routers import auth

app = FastAPI(
    title="Papelaria API",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)

app.include_router(auth.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
