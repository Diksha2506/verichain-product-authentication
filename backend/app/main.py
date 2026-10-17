from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .core.config import settings
from .api import products, supply_chain, verification, risk, alerts, blockchain

app = FastAPI(title="VeriChain Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "verichain-backend"}


app.include_router(products.router)
app.include_router(supply_chain.router)
app.include_router(verification.router)
app.include_router(risk.router)
app.include_router(alerts.router)
app.include_router(blockchain.router)
