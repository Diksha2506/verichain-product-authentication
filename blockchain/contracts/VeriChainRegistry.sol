// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract VeriChainRegistry {
    enum ProductStatus { AUTHENTIC, SUSPICIOUS, CLONE_SUSPECTED, INACTIVE }

    struct ProductRecord {
        string productId;
        address manufacturer;
        bytes32 metadataHash;
        uint256 registeredAt;
        ProductStatus status;
        bool active;
    }

    address public owner;
    
    // Mapping from string productId to the ProductRecord struct
    mapping(string => ProductRecord) private products;
    
    // Mapping from string productId to boolean to check if it exists
    mapping(string => bool) private productExists;

    event ProductRegistered(string indexed productId, address indexed manufacturer, bytes32 metadataHash, uint256 timestamp);
    event ProductStatusUpdated(string indexed productId, ProductStatus newStatus, uint256 timestamp);
    event VerificationRecorded(string indexed productId, address indexed verifier, bytes32 metadataHash, uint256 timestamp);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can perform this action");
        _;
    }

    modifier onlyExisting(string memory _productId) {
        require(productExists[_productId], "Product does not exist");
        _;
    }

    function registerProduct(
        string memory _productId,
        bytes32 _metadataHash
    ) external {
        require(!productExists[_productId], "Product already registered");
        require(bytes(_productId).length > 0, "Product ID cannot be empty");

        products[_productId] = ProductRecord({
            productId: _productId,
            manufacturer: msg.sender,
            metadataHash: _metadataHash,
            registeredAt: block.timestamp,
            status: ProductStatus.AUTHENTIC,
            active: true
        });

        productExists[_productId] = true;

        emit ProductRegistered(_productId, msg.sender, _metadataHash, block.timestamp);
    }

    function getProduct(string memory _productId) external view onlyExisting(_productId) returns (ProductRecord memory) {
        return products[_productId];
    }

    /**
     * @notice Updates the product status. Only contract owner or registering manufacturer is authorized.
     */
    function updateProductStatus(string memory _productId, ProductStatus _newStatus) external onlyExisting(_productId) {
        ProductRecord storage record = products[_productId];
        require(
            msg.sender == owner || msg.sender == record.manufacturer,
            "Unauthorized: only owner or manufacturer can update status"
        );

        record.status = _newStatus;
        if (_newStatus == ProductStatus.INACTIVE) {
            record.active = false;
        }

        emit ProductStatusUpdated(_productId, _newStatus, block.timestamp);
    }

    /**
     * @notice Verifies product identity and metadata integrity on-chain.
     * @dev Note: Blockchain verification validates identity registration and metadata integrity only.
     * It does NOT independently prove physical authenticity of an item.
     */
    function verifyProduct(
        string memory _productId,
        bytes32 _currentMetadataHash
    ) external onlyExisting(_productId) returns (bool matchFound) {
        ProductRecord memory p = products[_productId];
        require(p.active, "Product is inactive");
        matchFound = (p.metadataHash == _currentMetadataHash);
        
        emit VerificationRecorded(_productId, msg.sender, _currentMetadataHash, block.timestamp);
        
        return matchFound;
    }
}
