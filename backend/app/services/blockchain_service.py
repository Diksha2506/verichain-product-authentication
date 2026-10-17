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

CANONICAL_HASH_VERSION = "v1"

def escape_canonical_field(val: Optional[str]) -> str:
    """
    Escape field values for unambiguous delimiter boundary isolation.
    Replaces backslashes with '\\\\' and pipe '|' with '\\|'.
    None or empty values are handled explicitly.
    """
    if val is None:
        return "None"
    s = str(val).strip()
    if s == "":
        return "Empty"
    # Escapes backslash first, then pipe delimiter to prevent delimiter collision
    return s.replace("\\", "\\\\").replace("|", "\\|")


def build_canonical_metadata_string(
    product_id: str,
    manufacturer_id: Optional[str],
    batch_id: Optional[str],
    serial_number: Optional[str],
    manufactured_at_str: Optional[str]
) -> str:
    """
    Constructs the canonical metadata string (Version 1).
    Format:
        v1|productId|manufacturerId|batchId|serialNumber|manufacturedAt
    """
    p_id = escape_canonical_field(product_id)
    m_id = escape_canonical_field(manufacturer_id or "UNKNOWN")
    b_id = escape_canonical_field(batch_id)
    s_id = escape_canonical_field(serial_number)
    m_at = escape_canonical_field(manufactured_at_str)
    
    # Existing v1 demo compatibility: for existing clean demo products where fields contain no '|' or '\\'
    # we maintain legacy demo hash parity while isolating escaped boundaries.
    return f"{p_id}|{m_id}|{b_id}|{s_id}|{m_at}"


def generate_metadata_hash(product: Product) -> str:
    """
    Generate a canonical SHA-256 hash for a product's metadata.
    Enforces deterministic cross-language UTF-8 encoding.
    """
    m_at_str = product.manufactured_at.isoformat() if product.manufactured_at else None
    m_id = product.manufacturer.manufacturer_id if product.manufacturer else "UNKNOWN"
    
    canonical_string = build_canonical_metadata_string(
        product_id=product.product_id,
        manufacturer_id=m_id,
        batch_id=product.batch_id,
        serial_number=product.serial_number,
        manufactured_at_str=m_at_str
    )
    h = hashlib.sha256(canonical_string.encode('utf-8')).hexdigest()
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
