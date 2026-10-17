import hashlib
from typing import Optional
from web3 import Web3
from sqlalchemy.orm import Session
from ..models.product import Product
from ..models.blockchain import BlockchainTransaction
from ..core.config import settings
from datetime import datetime, timezone

# Configure from settings
WEB3_PROVIDER_URL = settings.BLOCKCHAIN_RPC_URL
CONTRACT_ADDRESS = settings.CONTRACT_ADDRESS

# The ABI for VeriChainRegistry
REGISTRY_ABI = [
    {
        "inputs": [
            {"internalType": "string", "name": "_productId", "type": "string"},
            {"internalType": "bytes32", "name": "_metadataHash", "type": "bytes32"}
        ],
        "name": "registerProduct",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "string", "name": "_productId", "type": "string"}],
        "name": "getProduct",
        "outputs": [
            {
                "components": [
                    {"internalType": "string", "name": "productId", "type": "string"},
                    {"internalType": "address", "name": "manufacturer", "type": "address"},
                    {"internalType": "bytes32", "name": "metadataHash", "type": "bytes32"},
                    {"internalType": "uint256", "name": "registeredAt", "type": "uint256"},
                    {"internalType": "enum VeriChainRegistry.ProductStatus", "name": "status", "type": "uint8"},
                    {"internalType": "bool", "name": "active", "type": "bool"}
                ],
                "internalType": "struct VeriChainRegistry.ProductRecord",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "_productId", "type": "string"},
            {"internalType": "enum VeriChainRegistry.ProductStatus", "name": "_newStatus", "type": "uint8"}
        ],
        "name": "updateProductStatus",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {"internalType": "string", "name": "_productId", "type": "string"},
            {"internalType": "bytes32", "name": "_currentMetadataHash", "type": "bytes32"}
        ],
        "name": "verifyProduct",
        "outputs": [{"internalType": "bool", "name": "matchFound", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

w3 = Web3(Web3.HTTPProvider(WEB3_PROVIDER_URL))

def generate_metadata_hash(product: Product) -> str:
    """Generate a canonical SHA-256 hash for a product's metadata."""
    # Ensure consistency with the format we use in TypeScript: 
    # `${p.productId}|${p.manufacturerId}|${p.batchId}|${p.serialNumber}|${p.manufacturedAt}`
    
    # We must match string formatting exactly.
    # In TypeScript: "2026-09-05T00:00:00+00:00"
    m_at_str = product.manufactured_at.isoformat() if product.manufactured_at else "None"
    
    # Manufacturer string matching seed.py manufacturer_id
    m_id = product.manufacturer.manufacturer_id if product.manufacturer else "UNKNOWN"
    
    metadata_string = f"{product.product_id}|{m_id}|{product.batch_id}|{product.serial_number}|{m_at_str}"
    h = hashlib.sha256(metadata_string.encode('utf-8')).hexdigest()
    return "0x" + h

def check_blockchain_verification(db: Session, product: Product) -> dict:
    """Check the product against the blockchain registry."""
    if not w3.is_connected():
        return {"status": "BLOCKCHAIN_ERROR", "message": "Could not connect to blockchain node."}
    
    contract = w3.eth.contract(address=w3.to_checksum_address(CONTRACT_ADDRESS), abi=REGISTRY_ABI)
    
    try:
        # Call getProduct
        record = contract.functions.getProduct(product.product_id).call()
    except Exception as e:
        # Revert means not found in our contract design
        if "Product does not exist" in str(e) or "execution reverted" in str(e).lower():
            return {"status": "NOT_REGISTERED", "message": "Product is not registered on the blockchain."}
        return {"status": "BLOCKCHAIN_ERROR", "message": str(e)}

    # record is a tuple matching the ABI struct
    on_chain_hash = "0x" + record[2].hex()
    is_active = record[5]
    
    if not is_active:
        return {"status": "INACTIVE", "message": "Product is registered but marked inactive."}
        
    expected_hash = generate_metadata_hash(product)
    
    if on_chain_hash != expected_hash:
        return {
            "status": "HASH_MISMATCH", 
            "message": f"Data integrity error. Blockchain hash {on_chain_hash} does not match database hash {expected_hash}."
        }
        
    return {"status": "VERIFIED", "message": "Product identity matches blockchain record."}
