from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.alert import Alert
from ..schemas.alert import AlertResponse
from ..services.product_service import get_product_by_product_id

router = APIRouter(tags=["alerts"])


@router.get("/api/alerts", response_model=list[AlertResponse])
def list_all_alerts(db: Session = Depends(get_db)):
    return (
        db.query(Alert)
        .order_by(Alert.resolved, Alert.created_at.desc())
        .all()
    )


@router.get("/api/products/{product_id}/alerts", response_model=list[AlertResponse])
def get_product_alerts(product_id: str, db: Session = Depends(get_db)):
    product = get_product_by_product_id(db, product_id)
    return (
        db.query(Alert)
        .filter(Alert.product_id == product.id)
        .order_by(Alert.created_at.desc())
        .all()
    )
