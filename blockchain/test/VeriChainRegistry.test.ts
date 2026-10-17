import { expect } from "chai";
import { ethers } from "hardhat";
import { VeriChainRegistry } from "../typechain-types";
import crypto from "crypto";

function sha256hex(data: string): string {
    return "0x" + crypto.createHash("sha256").update(data).digest("hex");
}

function metadataHash(productId: string, manufacturerId: string, batchId: string, serialNumber: string, manufacturedAt: string): string {
    return sha256hex(`${productId}|${manufacturerId}|${batchId}|${serialNumber}|${manufacturedAt}`);
}

describe("VeriChainRegistry", function () {
    let registry: VeriChainRegistry;
    let owner: any;
    let addr1: any;

    beforeEach(async function () {
        [owner, addr1] = await ethers.getSigners();
        const VCR = await ethers.getContractFactory("VeriChainRegistry");
        registry = (await VCR.deploy()) as VeriChainRegistry;
        await registry.waitForDeployment();
    });

    it("Should deploy successfully", async function () {
        expect(await registry.getAddress()).to.be.properAddress;
    });

    it("Should register a product", async function () {
        const hash = metadataHash("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00");
        await expect(registry.registerProduct("VC-NIKE-001", hash))
            .to.emit(registry, "ProductRegistered")
            .withArgs("VC-NIKE-001", owner.address, hash, (v: any) => v > 0n);
    });

    it("Should get a registered product", async function () {
        const hash = metadataHash("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00");
        await registry.registerProduct("VC-NIKE-001", hash);
        const record = await registry.getProduct("VC-NIKE-001");
        expect(record.productId).to.equal("VC-NIKE-001");
        expect(record.manufacturer).to.equal(owner.address);
        expect(record.metadataHash).to.equal(hash);
        expect(record.active).to.be.true;
        expect(record.status).to.equal(0); // AUTHENTIC
    });

    it("Should reject duplicate registrations", async function () {
        const hash = metadataHash("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00");
        await registry.registerProduct("VC-NIKE-001", hash);
        await expect(registry.registerProduct("VC-NIKE-001", hash)).to.be.revertedWith("Product already registered");
    });

    it("Should reject empty product ID", async function () {
        const hash = metadataHash("", "MFG", "B1", "SN1", "2026-01-01");
        await expect(registry.registerProduct("", hash)).to.be.revertedWith("Product ID cannot be empty");
    });

    it("Should revert getProduct for unregistered product", async function () {
        await expect(registry.getProduct("NONEXISTENT")).to.be.revertedWith("Product does not exist");
    });

    it("Should verify product with matching hash (returns true)", async function () {
        const hash = metadataHash("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00");
        await registry.registerProduct("VC-NIKE-001", hash);
        const result = await registry.verifyProduct.staticCall("VC-NIKE-001", hash);
        expect(result).to.be.true;
    });

    it("Should detect hash mismatch (HASH_MISMATCH scenario)", async function () {
        const originalHash = metadataHash("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00");
        // Simulates serial number changed from NK-A26-0091842 to SN-99999
        const tamperedHash = metadataHash("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "SN-99999", "2026-09-05T00:00:00+00:00");

        await registry.registerProduct("VC-NIKE-001", originalHash);

        const result = await registry.verifyProduct.staticCall("VC-NIKE-001", tamperedHash);
        expect(result).to.be.false; // hash mismatch detected
    });

    it("Should update product status", async function () {
        const hash = metadataHash("VC-SONY-003", "MFG-SONY-JP", "WH6-77A", "SN-WH6-779203", "2026-07-22T00:00:00+00:00");
        await registry.registerProduct("VC-SONY-003", hash);
        await expect(registry.updateProductStatus("VC-SONY-003", 1)) // SUSPICIOUS
            .to.emit(registry, "ProductStatusUpdated")
            .withArgs("VC-SONY-003", 1, (v: any) => v > 0n);

        const record = await registry.getProduct("VC-SONY-003");
        expect(record.status).to.equal(1); // SUSPICIOUS
    });

    it("Should register VC-FAKE-999 (blockchain verified != physically authentic)", async function () {
        // A counterfeit product can copy a legitimate product's identity
        // Blockchain VERIFIED does NOT mean physically authentic - that's decided by risk engine
        const fakeHash = metadataHash("VC-FAKE-999", "MFG-NIKE-US", "UNREGISTERED", "XX-000-9999", "None");
        await registry.registerProduct("VC-FAKE-999", fakeHash);
        const record = await registry.getProduct("VC-FAKE-999");
        expect(record.active).to.be.true;
        // The risk engine will still flag it CRITICAL based on behavioral evidence
    });

    it("Should deterministically produce the same hash for the same metadata", async function () {
        const h1 = metadataHash("VC-APPLE-002", "MFG-APPLE-US", "AW-S11-204", "AW11-4209816", "2026-08-18T00:00:00+00:00");
        const h2 = metadataHash("VC-APPLE-002", "MFG-APPLE-US", "AW-S11-204", "AW11-4209816", "2026-08-18T00:00:00+00:00");
        expect(h1).to.equal(h2);
    });

    it("Should reject unauthorized status updates", async function () {
        const hash = metadataHash("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00");
        // Registered by owner
        await registry.registerProduct("VC-NIKE-001", hash);
        
        // addr1 tries to update status
        await expect(
            registry.connect(addr1).updateProductStatus("VC-NIKE-001", 1)
        ).to.be.revertedWith("Unauthorized: only owner or manufacturer can update status");
    });

    it("Should allow registering manufacturer to update status", async function () {
        const hash = metadataHash("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00");
        // addr1 registers product
        await registry.connect(addr1).registerProduct("VC-NIKE-001", hash);

        // addr1 updates status
        await expect(registry.connect(addr1).updateProductStatus("VC-NIKE-001", 1))
            .to.emit(registry, "ProductStatusUpdated")
            .withArgs("VC-NIKE-001", 1, (v: any) => v > 0n);

        const record = await registry.getProduct("VC-NIKE-001");
        expect(record.status).to.equal(1);
    });

    it("Should revert verification when product is marked inactive", async function () {
        const hash = metadataHash("VC-NIKE-001", "MFG-NIKE-US", "B2026-091", "NK-A26-0091842", "2026-09-05T00:00:00+00:00");
        await registry.registerProduct("VC-NIKE-001", hash);

        // Set to INACTIVE (enum index 3)
        await registry.updateProductStatus("VC-NIKE-001", 3);
        const record = await registry.getProduct("VC-NIKE-001");
        expect(record.active).to.be.false;

        // Verification call must revert because inactive products cannot pass verification
        await expect(
            registry.verifyProduct.staticCall("VC-NIKE-001", hash)
        ).to.be.revertedWith("Product is inactive");
    });
});
