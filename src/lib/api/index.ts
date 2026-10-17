/**
 * Public API surface for the VeriChain service layer.
 *
 * Components import from here — never directly from individual service files.
 * Swapping mock → real backend in Phase 2 only changes these service files,
 * not any component.
 */
export { getProducts, getProduct, getProductRisk, searchProducts, ProductIdSchema } from "./productApi";
export { verifyProduct, getVerificationHistory, VerificationRequestSchema } from "./verificationApi";
export { getProductRiskAssessment, getAllRiskAssessments } from "./riskApi";
export { getBlockchainTransactions, getNetworkStatus } from "./blockchainApi";
export { getProductProvenance } from "./supplyChainApi";
export { getAlerts, getUnacknowledgedAlertCount } from "./alertApi";
export { API_CONFIG, API_BASE, API_ENDPOINTS } from "./config";
