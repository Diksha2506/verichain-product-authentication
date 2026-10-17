from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import json
from web3 import Web3

from ..core.database import get_db
from ..models.product import Product
from ..models.blockchain import BlockchainTransaction
from ..schemas.blockchain import BlockchainTransactionResponse, BlockchainRegistrationResponse
from ..services.product_service import get_product_by_product_id
from ..services.blockchain_service import w3, CONTRACT_ADDRESS, REGISTRY_ABI, generate_metadata_hash

router = APIRouter(prefix="/api/products", tags=["blockchain"])

@router.get("/{product_id}/blockchain", response_model=list[BlockchainTransactionResponse])
def get_blockchain_history(product_id: str, db: Session = Depends(get_db)):
    product = get_product_by_product_id(db, product_id)
    transactions = (
        db.query(BlockchainTransaction)
        .filter(BlockchainTransaction.product_id == product.id)
        .order_by(BlockchainTransaction.timestamp.desc())
        .all()
    )
    return transactions

@router.post("/{product_id}/blockchain/register", response_model=BlockchainRegistrationResponse)
def register_product_on_chain(product_id: str, db: Session = Depends(get_db)):
    product = get_product_by_product_id(db, product_id)
    
    if not w3.is_connected():
        raise HTTPException(status_code=503, detail="Blockchain node unavailable")
        
    contract = w3.eth.contract(address=w3.to_checksum_address(CONTRACT_ADDRESS), abi=REGISTRY_ABI)
    
    # Generate metadata hash
    metadata_hash = generate_metadata_hash(product)
    
    # We would use a dedicated account for the backend to pay for tx fees
    # Here we just use the first local account
    accounts = w3.eth.accounts
    if not accounts:
        raise HTTPException(status_code=500, detail="No accounts available on local node")
    
    tx_sender = accounts[0]
    
    # Check if already registered on blockchain
    try:
        record = contract.functions.getProduct(product_id).call()
        # If call succeeds, product is already registered on-chain
        # Check if we already have this transaction recorded in DB
        existing_tx = (
            db.query(BlockchainTransaction)
            .filter(BlockchainTransaction.product_id == product.id, BlockchainTransaction.status == "CONFIRMED")
            .order_by(BlockchainTransaction.timestamp.desc())
            .first()
        )
        if existing_tx:
            return BlockchainRegistrationResponse(
                productId=product_id,
                metadataHash=existing_tx.metadata_hash,
                transactionHash=existing_tx.transaction_hash,
                blockNumber=existing_tx.block_number,
                contractAddress=existing_tx.contract_address,
                network=existing_tx.network,
                registeredAt=existing_tx.timestamp
            )
        raise HTTPException(status_code=409, detail="Product is already registered on-chain")
    except HTTPException:
        raise
    except Exception as e:
        if "already registered" in str(e).lower():
            raise HTTPException(status_code=409, detail="Product is already registered on-chain")
        # Expected exception (revert) if it doesn't exist yet on chain
        pass

    try:
        tx_hash = contract.functions.registerProduct(
            product_id,
            Web3.to_bytes(hexstr=metadata_hash)
        ).transact({'from': tx_sender})
        
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Blockchain transaction failed: {str(e)}")

    now = datetime.now(timezone.utc)
    
    tx_record = BlockchainTransaction(
        product_id=product.id,
        transaction_hash=receipt.transactionHash.hex(),
        block_number=receipt.blockNumber,
        transaction_type="REGISTRATION",
        metadata_hash=metadata_hash,
        contract_address=CONTRACT_ADDRESS,
        network="hardhat",
        status="CONFIRMED" if receipt.status == 1 else "FAILED",
        timestamp=now
    )
    db.add(tx_record)
    
    # Update product metadata_hash if empty
    if not product.metadata_hash:
        product.metadata_hash = metadata_hash
        
    try:
        db.commit()
        db.refresh(tx_record)
    except Exception as db_err:
        db.rollback()
        # The chain transaction succeeded but DB commit failed.
        # Log and report so caller knows transactionHash on-chain.
        raise HTTPException(
            status_code=500,
            detail=f"Blockchain transaction succeeded ({receipt.transactionHash.hex()}) at block {receipt.blockNumber}, but database persistence failed: {str(db_err)}"
        )
    
    return BlockchainRegistrationResponse(
        productId=product_id,
        metadataHash=metadata_hash,
        transactionHash=tx_record.transaction_hash,
        blockNumber=tx_record.block_number,
        contractAddress=CONTRACT_ADDRESS,
        network="hardhat",
        registeredAt=now
    )
