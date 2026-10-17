"""
Product service — database operations.
All business logic lives here; routers stay thin.
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException

from ..models.product import Product
from ..models.manufacturer import Manufacturer
from ..schemas.product import ProductCreate


def get_all_products(db: Session) -> list[Product]:
    return db.query(Product).all()


def get_product_by_product_id(db: Session, product_id: str) -> Product:
    _validate_product_id(product_id)
    product = (
        db.query(Product)
        .filter(Product.product_id == product_id.upper())
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


def create_product(db: Session, payload: ProductCreate) -> Product:
    existing = db.query(Product).filter(Product.product_id == payload.product_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Product ID already exists")
    product = Product(**payload.model_dump())
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def _validate_product_id(product_id: str) -> None:
    import re
    if not product_id or not re.match(r"^[A-Za-z0-9\-_]{1,64}$", product_id):
        raise HTTPException(status_code=400, detail="Invalid product ID")
