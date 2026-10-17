/**
 * Legacy mock API shim — Phase 1
 *
 * This file keeps all existing component imports working while the
 * codebase migrates to the new service layer in src/lib/api/.
 *
 * @deprecated  Import from "@/lib/api" instead.
 *
 * Existing synchronous callers (getProduct, getProducts) are kept sync
 * for backward compat; the route component will be updated in a future
 * commit to use the async service layer directly.
 */
import { products, verificationHistory, blockchainTransactions } from "./mockData";
import { assessRisk, calculateRisk } from "./riskEngine";

// ─── Synchronous helpers (backward compat) ───────────────────────────────────

/** @deprecated Use getProduct() from "@/lib/api" */
export const getProducts = () => products;

/** @deprecated Use getProduct() from "@/lib/api" */
export const getProduct = (productId: string) =>
  products.find((p) => p.id.toLowerCase() === productId.trim().toLowerCase());

/** @deprecated Use verifyProduct() from "@/lib/api" */
export const verifyProduct = (productId: string) => {
  const product = getProduct(productId);
  const riskScore = product ? calculateRisk(product) : 0;
  return { product: product ?? null, riskScore, verifiedAt: "Just now" };
};

/** @deprecated Use getVerificationHistory() from "@/lib/api" */
export const getVerificationHistory = (_productId?: string) =>
  verificationHistory.map((e) => ({
    productId: e.productId,
    time: e.timeAgo,
    place: e.place,
  }));

/** @deprecated Use getProductProvenance() from "@/lib/api" */
export const getProvenance = (productId: string) => ({
  product: getProduct(productId),
  nodes: ["Manufacturer", "Distribution hub", "Retail partner", "Verified customer"],
});

/** @deprecated Use getBlockchainTransactions() from "@/lib/api" */
export const getBlockchainTransactions = (_productId?: string) =>
  blockchainTransactions.map((tx) => ({
    block: tx.blockNumber,
    hash: tx.hash,
    timestamp: tx.timeAgo,
    event: tx.event,
    productId: tx.productId,
    status: tx.status,
  }));

/** @deprecated Use getProductRiskAssessment() from "@/lib/api" */
export const getRiskAnalysis = (productId: string) => {
  const product = getProduct(productId);
  return product
    ? { product, riskScore: calculateRisk(product), assessment: assessRisk(product.riskFactors) }
    : null;
};