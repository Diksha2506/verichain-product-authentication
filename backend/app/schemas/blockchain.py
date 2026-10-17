from pydantic import BaseModel, ConfigDict
from datetime import datetime

class BlockchainTransactionResponse(BaseModel):
    id: int
    transaction_hash: str
    block_number: int | None
    transaction_type: str
    metadata_hash: str
    contract_address: str
    network: str
    status: str
    timestamp: datetime
    
    model_config = ConfigDict(from_attributes=True)

class BlockchainRegistrationResponse(BaseModel):
    productId: str
    metadataHash: str
    transactionHash: str
    blockNumber: int | None
    contractAddress: str
    network: str
    registeredAt: datetime
