from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.supply_chain import SupplyChainEvent
from ..models.product import Product
from ..schemas.supply_chain import SupplyChainEventResponse
from ..services.product_service import get_product_by_product_id

router = APIRouter(prefix="/api/products", tags=["supply-chain"])


@router.get("/{product_id}/provenance", response_model=list[SupplyChainEventResponse])
def get_provenance(product_id: str, db: Session = Depends(get_db)):
    product = get_product_by_product_id(db, product_id)
    events = (
        db.query(SupplyChainEvent)
        .filter(SupplyChainEvent.product_id == product.id)
        .order_by(SupplyChainEvent.timestamp)
        .all()
    )
    return events
