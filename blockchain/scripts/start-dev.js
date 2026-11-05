#!/usr/bin/env node
/**
 * VeriChain Blockchain Dev Server
 *
 * This script:
 * 1. Starts a Hardhat local node (http://127.0.0.1:8545)
 * 2. Waits until the RPC endpoint actually answers on the expected chain
 * 3. Deploys VeriChainRegistry and registers all 4 demo products
 * 4. Saves deployed.json with addresses and TX hashes
 * 5. Keeps the node running (it will not exit)
 *
 * Usage:
 *   npx hardhat node             (manual: start node in one terminal)
 *   npx hardhat run scripts/register-demo-products.ts --network localhost  (manual: register in another)
 *
 * OR simply run:
 *   node scripts/start-dev.js    (this file does both)
 *
 * Readiness is polled, never assumed from a fixed delay. If the node does not
 * come up on the expected chain, the script fails loudly instead of deploying
 * against an unavailable or wrong endpoint.
 */

// This file intentionally not TypeScript — it's a plain runner
const { spawn, execSync } = require("child_process");
const http = require("http");
const path = require("path");

const BLOCKCHAIN_DIR = __dirname.replace("scripts", "");
const HARDHAT = path.join(BLOCKCHAIN_DIR, "node_modules", ".bin", "hardhat");
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
const EXPECTED_CHAIN_ID = 31337;
const READY_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 500;

console.log("=== VeriChain Blockchain Dev Server ===");
console.log("Starting Hardhat node on http://127.0.0.1:8545 ...\n");

// Start node
const node = spawn(HARDHAT, ["node"], {
    cwd: BLOCKCHAIN_DIR,
    stdio: ["ignore", "pipe", "pipe"],
    shell: true,
});

node.stdout.on("data", (d) => process.stdout.write(d));
node.stderr.on("data", (d) => process.stderr.write(d));

/** Minimal JSON-RPC call against the local node. */
function rpc(method, params = []) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify({ jsonrpc: "2.0", id: 1, method, params });
        const req = http.request(
            RPC_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Content-Length": Buffer.byteLength(body),
                },
            },
            (res) => {
                let data = "";
                res.setEncoding("utf8");
                res.on("data", (chunk) => (data += chunk));
                res.on("end", () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.error) reject(new Error(parsed.error.message || "RPC error"));
                        else resolve(parsed.result);
                    } catch (error) {
                        reject(new Error(`Invalid RPC response: ${error.message}`));
                    }
                });
            }
        );
        req.on("error", reject);
        req.setTimeout(2_000, () => req.destroy(new Error("RPC request timed out")));
        req.write(body);
        req.end();
    });
}

/**
 * Poll until the node answers with the expected chain id.
 * Throws (rather than deploying blindly) when it never becomes ready.
 */
async function waitForChain() {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    let lastError = null;

    while (Date.now() < deadline) {
        try {
            const chainId = Number(BigInt(await rpc("eth_chainId")));
            if (chainId !== EXPECTED_CHAIN_ID) {
                throw new Error(
                    `node reports chain id ${chainId}, expected ${EXPECTED_CHAIN_ID}`
                );
            }
            await rpc("eth_blockNumber");
            return chainId;
        } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
    }

    throw new Error(
        `Hardhat RPC did not become ready on ${RPC_URL} within ${READY_TIMEOUT_MS}ms` +
            (lastError ? `: ${lastError.message}` : "")
    );
}

async function main() {
    try {
        const chainId = await waitForChain();
        console.log(`\nRPC ready on chain ${chainId}.`);
        console.log("\n=== Deploying & Registering Demo Products ===\n");

        const out = execSync(
            `"${HARDHAT}" run scripts/register-demo-products.ts --network localhost`,
            { cwd: BLOCKCHAIN_DIR, encoding: "utf-8" }
        );
        console.log(out);
    } catch (error) {
        console.error("\nStartup failed:", error.message);
        node.kill();
        process.exit(1);
    }
}

void main();

node.on("exit", (code) => {
    console.log(`Hardhat node exited with code ${code}`);
    process.exit(code ?? 0);
});
