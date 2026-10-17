from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..schemas.product import ProductCreate, ProductResponse
from ..services.product_service import (
    get_all_products,
    get_product_by_product_id,
    create_product,
)

router = APIRouter(prefix="/api/products", tags=["products"])


@router.get("", response_model=list[ProductResponse])
def list_products(db: Session = Depends(get_db)):
    return get_all_products(db)


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product_id: str, db: Session = Depends(get_db)):
    return get_product_by_product_id(db, product_id)


@router.post("", response_model=ProductResponse, status_code=201)
def create_new_product(payload: ProductCreate, db: Session = Depends(get_db)):
    return create_product(db, payload)
