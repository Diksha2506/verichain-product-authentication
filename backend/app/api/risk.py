from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..core.database import get_db
from ..models.risk import RiskAssessment
from ..schemas.risk import RiskAssessmentResponse
from ..services.product_service import get_product_by_product_id

router = APIRouter(prefix="/api/products", tags=["risk"])


@router.get("/{product_id}/risk", response_model=list[RiskAssessmentResponse])
def get_risk(product_id: str, db: Session = Depends(get_db)):
    product = get_product_by_product_id(db, product_id)
    assessments = (
        db.query(RiskAssessment)
        .filter(RiskAssessment.product_id == product.id)
        .order_by(RiskAssessment.created_at.desc())
        .all()
    )
    return assessments
