from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.product import Product
from app.services.blockchain_service import check_blockchain_verification, generate_metadata_hash

def run_test():
    db = SessionLocal()
    # We will test on VC-NIKE-001
    product = db.query(Product).filter_by(product_id="VC-NIKE-001").first()
    if not product:
        print("Product not found.")
        return
        
    print(f"Original Serial: {product.serial_number}")
    print(f"Original Hash (on-chain): {generate_metadata_hash(product)}")
    
    # Store original
    original_serial = product.serial_number
    
    try:
        # Alter the product in PostgreSQL
        product.serial_number = "SN-99999"
        db.commit()
        db.refresh(product)
        
        print(f"New Serial: {product.serial_number}")
        print(f"New Hash (recomputed): {generate_metadata_hash(product)}")
        
        # Check blockchain verification
        result = check_blockchain_verification(db, product)
        print(f"Blockchain Verification Result: {result['status']}")
        print(f"Message: {result['message']}")
        
    finally:
        # Revert changes to keep demo clean
        product.serial_number = original_serial
        db.commit()
        print("Restored original product state.")

if __name__ == "__main__":
    run_test()
