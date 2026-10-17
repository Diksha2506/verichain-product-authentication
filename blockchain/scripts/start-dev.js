#!/usr/bin/env node
/**
 * VeriChain Blockchain Dev Server
 *
 * This script:
 * 1. Starts a Hardhat local node (http://127.0.0.1:8545)
 * 2. Deploys VeriChainRegistry
 * 3. Registers all 4 demo products
 * 4. Saves deployed.json with addresses and TX hashes
 * 5. Keeps the node running (it will not exit)
 *
 * Usage:
 *   npx hardhat node             (manual: start node in one terminal)
 *   npx hardhat run scripts/register-demo-products.ts --network localhost  (manual: register in another)
 *
 * OR simply run:
 *   node scripts/start-dev.js    (this file does both)
 */

// This file intentionally not TypeScript — it's a plain runner
const { spawn, execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const BLOCKCHAIN_DIR = __dirname.replace("scripts", "");
const HARDHAT = path.join(BLOCKCHAIN_DIR, "node_modules", ".bin", "hardhat");

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

// Wait for node to be ready then deploy+register
setTimeout(() => {
    console.log("\n=== Deploying & Registering Demo Products ===\n");
    try {
        const out = execSync(
            `"${HARDHAT}" run scripts/register-demo-products.ts --network localhost`,
            { cwd: BLOCKCHAIN_DIR, encoding: "utf-8" }
        );
        console.log(out);
    } catch (e) {
        console.error("Registration failed:", e.message);
    }
}, 3000);

node.on("exit", (code) => {
    console.log(`Hardhat node exited with code ${code}`);
    process.exit(code ?? 0);
});
