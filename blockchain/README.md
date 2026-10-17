# VeriChain Blockchain Layer

Local Ethereum-compatible blockchain for VeriChain product identity verification.

## Stack

- **Solidity 0.8.24** — smart contract
- **Hardhat 2** — local blockchain framework
- **TypeScript** — scripts and tests
- **ethers.js v6** — contract interaction
- **web3.py 6** — Python backend connector

## Directory Structure

```
blockchain/
├── contracts/
│   └── VeriChainRegistry.sol    # Core product registry contract
├── scripts/
│   ├── deploy.ts                # Deploy contract only
│   ├── register-demo-products.ts  # Deploy + register all 4 demo products
│   └── start-dev.js             # Start node + deploy + register (one command)
├── test/
│   └── VeriChainRegistry.test.ts  # 11 contract tests
├── hardhat.config.ts
└── deployed.json                  # Auto-generated after running start-dev.js
```

## Quick Start

### Step 1: Start the blockchain (in a dedicated terminal)

```powershell
cd blockchain
node scripts/start-dev.js
```

This will:
1. Start a Hardhat node at `http://127.0.0.1:8545`
2. Deploy `VeriChainRegistry`
3. Register all 4 demo products with real SHA-256 metadata hashes
4. Save results to `deployed.json`

> **Keep this terminal open** — the backend needs the node to be running.

### Step 2: Start the backend (in another terminal)

```powershell
cd backend
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```

The backend connects to `http://127.0.0.1:8545` automatically.

---

## Smart Contract: VeriChainRegistry

### ProductRecord struct

| Field | Type | Description |
|---|---|---|
| `productId` | `string` | VeriChain product ID (e.g. `VC-NIKE-001`) |
| `manufacturer` | `address` | Ethereum address of registering account |
| `metadataHash` | `bytes32` | SHA-256 of canonical product metadata |
| `registeredAt` | `uint256` | Unix timestamp |
| `status` | `enum` | AUTHENTIC / SUSPICIOUS / CLONE_SUSPECTED / INACTIVE |
| `active` | `bool` | Whether the record is active |

### Functions

| Function | Description |
|---|---|
| `registerProduct(id, hash)` | Register a new product |
| `getProduct(id)` | Read a product record |
| `verifyProduct(id, hash)` | Check if recomputed hash matches stored hash |
| `updateProductStatus(id, status)` | Change product status |

---

## Metadata Hash

The hash uses **SHA-256** over a deterministic canonical string:

```
{productId}|{manufacturerId}|{batchId}|{serialNumber}|{manufacturedAt}
```

Example:
```
VC-NIKE-001|MFG-NIKE-US|B2026-091|NK-A26-0091842|2026-09-05T00:00:00+00:00
```

The **Python backend** (`blockchain_service.py`) recomputes this hash at verification time. If the database record was tampered (e.g. serial number changed), the hashes won't match → `HASH_MISMATCH`.

---

## Blockchain States

| State | Meaning |
|---|---|
| `VERIFIED` | Product exists, is active, hash matches |
| `NOT_REGISTERED` | Product not in smart contract |
| `HASH_MISMATCH` | Product found but database metadata was altered |
| `INACTIVE` | Product registered but deactivated |
| `BLOCKCHAIN_ERROR` | Cannot connect to node |

---

## Important Design Decision

> **Blockchain `VERIFIED` ≠ Physically Authentic**

`VC-FAKE-999` is intentionally registered on-chain. A counterfeit product can copy a legitimate product's blockchain identity. The **final authenticity decision** combines:

1. Blockchain identity (registered + hash match)
2. Behavioral risk (impossible travel, scan frequency, supply chain)
3. Provenance history (manufacturing records)

---

## Running Tests

```powershell
cd blockchain
npx hardhat test
```

All 11 tests cover: deployment, registration, duplicate rejection, hash mismatch detection, status updates, and the FAKE-999 identity scenario.

---

## Contract Address (Deterministic)

Hardhat always assigns the same address for the first contract deployed by account 0:

```
0x5FbDB2315678afecb367f032d93F642f64180aa3
```

This is hardcoded in `backend/app/services/blockchain_service.py`. No configuration needed for local development.

---

## Safety

- ✅ Local only — never connects to mainnet
- ✅ No real cryptocurrency used
- ✅ No real wallet/private key required
- ✅ All keys are Hardhat test accounts (well-known, public)
- ✅ No system-level changes (no registry, firewall, or PATH changes)
- ✅ `deployed.json` is git-ignored (contains local TX hashes)
