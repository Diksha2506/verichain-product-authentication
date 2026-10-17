import { ethers } from "hardhat";
import crypto from "crypto";
import fs from "fs";
import path from "path";

// SHA-256 hash matching the Python backend implementation exactly
function sha256hex(data: string): string {
    return "0x" + crypto.createHash("sha256").update(data).digest("hex");
}

// Products must match backend/seed.py exactly
const DEMO_PRODUCTS = [
    {
        productId: "VC-NIKE-001",
        manufacturerId: "MFG-NIKE-US",
        batchId: "B2026-091",
        serialNumber: "NK-A26-0091842",
        manufacturedAt: "2026-09-05T00:00:00+00:00",
    },
    {
        productId: "VC-APPLE-002",
        manufacturerId: "MFG-APPLE-US",
        batchId: "AW-S11-204",
        serialNumber: "AW11-4209816",
        manufacturedAt: "2026-08-18T00:00:00+00:00",
    },
    {
        productId: "VC-SONY-003",
        manufacturerId: "MFG-SONY-JP",
        batchId: "WH6-77A",
        serialNumber: "SN-WH6-779203",
        manufacturedAt: "2026-07-22T00:00:00+00:00",
    },
    {
        // VC-FAKE-999: intentionally registered with a cloned identity
        // Blockchain verification VERIFIED ≠ physically authentic
        productId: "VC-FAKE-999",
        manufacturerId: "MFG-NIKE-US",
        batchId: "UNREGISTERED",
        serialNumber: "XX-000-9999",
        manufacturedAt: "None",
    },
];

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const outputPath = path.join(__dirname, "..", "deployed.json");
    let contractAddress: string | null = null;
    let existingData: any = null;

    if (fs.existsSync(outputPath)) {
        try {
            existingData = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
            if (existingData?.contractAddress) {
                // Verify if contract code exists at this address on current chain
                const code = await ethers.provider.getCode(existingData.contractAddress);
                if (code && code !== "0x") {
                    contractAddress = existingData.contractAddress;
                    console.log(`Re-using existing deployed contract at: ${contractAddress}`);
                }
            }
        } catch {
            // ignore error reading old file
        }
    }

    let registry: any;
    if (!contractAddress) {
        console.log("\nDeploying VeriChainRegistry...");
        const VeriChainRegistry = await ethers.getContractFactory("VeriChainRegistry");
        registry = await VeriChainRegistry.deploy();
        await registry.waitForDeployment();
        contractAddress = await registry.getAddress();
        console.log("Contract deployed to:", contractAddress);
    } else {
        registry = await ethers.getContractAt("VeriChainRegistry", contractAddress);
    }

    const results: Record<string, any> = existingData?.products || {};

    // Register demo products
    for (const p of DEMO_PRODUCTS) {
        const metadataString = `${p.productId}|${p.manufacturerId}|${p.batchId}|${p.serialNumber}|${p.manufacturedAt}`;
        const metadataHash = sha256hex(metadataString);

        console.log(`\nChecking ${p.productId}...`);
        
        // Check if already registered on-chain
        try {
            const existingRecord = await registry.getProduct(p.productId);
            if (existingRecord && existingRecord.productId === p.productId) {
                console.log(`  Already registered on-chain with hash: ${existingRecord.metadataHash}`);
                if (!results[p.productId]) {
                    results[p.productId] = {
                        metadataHash,
                        transactionHash: "pre-existing",
                        blockNumber: 0,
                        contractAddress,
                        network: "hardhat-localhost",
                    };
                }
                continue;
            }
        } catch {
            // Reverted = not registered yet, proceed to register
        }

        console.log(`  Registering ${p.productId}...`);
        console.log(`  Canonical string: ${metadataString}`);
        console.log(`  Metadata hash:    ${metadataHash}`);

        try {
            const tx = await registry.registerProduct(p.productId, metadataHash as `0x${string}`);
            const receipt = await tx.wait();
            const txHash = receipt?.hash ?? "unknown";
            const blockNum = receipt?.blockNumber ?? 0;

            console.log(`  TX hash:          ${txHash}`);
            console.log(`  Block:            ${blockNum}`);

            results[p.productId] = {
                metadataHash,
                transactionHash: txHash,
                blockNumber: blockNum,
                contractAddress,
                network: "hardhat-localhost",
            };
        } catch (e: any) {
            console.error(`  Failed to register ${p.productId}: ${e.message}`);
        }
    }

    // Save results next to this script for reference
    const outputPath = path.join(__dirname, "..", "deployed.json");
    fs.writeFileSync(
        outputPath,
        JSON.stringify({ contractAddress, products: results }, null, 2),
        "utf-8"
    );
    console.log(`\nDeployment results saved to ${outputPath}`);
    console.log("\nDone. Keep the Hardhat node running for the backend to connect.");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
