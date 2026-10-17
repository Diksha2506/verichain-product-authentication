/**
 * VeriChain mock data — Phase 1
 *
 * Internally consistent product records designed to exercise every
 * risk factor and verification outcome. Realistic contradictory events
 * are included for the clone detection algorithm in Phase 3.
 *
 * Components must NOT import this file directly.
 * Use the service layer in src/lib/api/ instead.
 */
import type { Product, RecentScan } from "@/types/product";
import type { BlockchainTransaction } from "@/types/blockchain";
import type { VerificationHistoryEntry } from "@/types/verification";
import type { Alert } from "@/types/alert";
import type { ProvenanceRecord } from "@/types/supplyChain";

// ─── Helper ───────────────────────────────────────────────────────────────────

function scan(location: string, timestamp: string, timeDisplay: string): RecentScan {
  return { location, timestamp, timeDisplay };
}

// ─── Products ────────────────────────────────────────────────────────────────

export const products: Product[] = [
  // ── VC-NIKE-001 · Authentic, LOW risk ──────────────────────────────────────
  {
    id: "VC-NIKE-001",
    name: "Nike Air Max 2026",
    manufacturer: "Nike",
    manufacturerId: "MFG-NIKE-US",
    batchId: "B2026-091",
    serialNumber: "NK-A26-0091842",
    metadataHash:
      "a3f9d2e1b8c7f4a0e6d3c2b1a9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0",
    status: "AUTHENTIC",
    manufacturedAt: "2026-09-05",
    manufacturedDisplay: "05 Sep 2026",
    riskFactors: {
      location: 3,
      duplicateScans: 2,
      travel: 1,
      supplyChain: 2,
      frequency: 4,
    },
    recentScans: [
      scan("Portland, OR", "2026-10-05T17:37:00Z", "12 min ago"),
      scan("San Francisco, CA", "2026-10-05T15:49:00Z", "2 hr ago"),
    ],
    blockchainTxHash: "0x7a91…e82c",
  },

  // ── VC-APPLE-002 · Authentic / Medium risk ─────────────────────────────────
  {
    id: "VC-APPLE-002",
    name: "Apple Watch Series 11",
    manufacturer: "Apple",
    manufacturerId: "MFG-APPLE-US",
    batchId: "AW-S11-204",
    serialNumber: "AW11-4209816",
    metadataHash:
      "b4e0d3c2a1f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3",
    status: "AUTHENTIC",
    manufacturedAt: "2026-08-18",
    manufacturedDisplay: "18 Aug 2026",
    riskFactors: {
      location: 5,
      duplicateScans: 3,
      travel: 4,
      supplyChain: 2,
      frequency: 4,
    },
    recentScans: [
      scan("Cupertino, CA", "2026-10-05T17:11:00Z", "38 min ago"),
      scan("San Jose, CA", "2026-10-04T17:49:00Z", "yesterday"),
    ],
    blockchainTxHash: "0x4c30…a921",
  },

  // ── VC-SONY-003 · Suspicious, HIGH risk ────────────────────────────────────
  // Two scans from geographically distant cities within 17 minutes —
  // impossible travel that the clone detector flags.
  {
    id: "VC-SONY-003",
    name: "Sony WH-1000XM6",
    manufacturer: "Sony",
    manufacturerId: "MFG-SONY-JP",
    batchId: "WH6-77A",
    serialNumber: "SN-WH6-779203",
    metadataHash:
      "c5f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1",
    status: "SUSPICIOUS",
    manufacturedAt: "2026-07-22",
    manufacturedDisplay: "22 Jul 2026",
    riskFactors: {
      location: 20,
      duplicateScans: 15,
      travel: 18,
      supplyChain: 8,
      frequency: 6,
    },
    recentScans: [
      // Singapore → London in 17 min is physically impossible (~13 hr flight)
      scan("Singapore", "2026-10-05T17:45:00Z", "4 min ago"),
      scan("London, UK", "2026-10-05T17:28:00Z", "21 min ago"),
      scan("Singapore", "2026-10-05T14:49:00Z", "3 hr ago"),
    ],
    blockchainTxHash: "0x2f81…bc09",
  },

  // ── VC-FAKE-999 · Clone suspected, CRITICAL risk ───────────────────────────
  // Scanned in three Indian cities within 34 minutes — physically impossible
  // (Pune→Mumbai is ~3 hr drive, Mumbai→Delhi is ~2 hr flight).
  // Supply chain record is entirely absent from the ledger.
  {
    id: "VC-FAKE-999",
    name: "Air Max 2026 · unverified unit",
    manufacturer: "Unknown",
    manufacturerId: undefined,
    batchId: "UNREGISTERED",
    serialNumber: "XX-000-9999",
    metadataHash: "0000000000000000000000000000000000000000000000000000000000000000",
    status: "CLONE SUSPECTED",
    manufacturedAt: "Unknown",
    manufacturedDisplay: "Unknown",
    riskFactors: {
      location: 30,
      duplicateScans: 25,
      travel: 20,
      supplyChain: 15,
      frequency: 4,
    },
    recentScans: [
      // Scanned in Pune at 09:12, Mumbai at 09:27 (15 min, ~3 hr drive),
      // then Delhi at 09:34 (7 min after Mumbai, ~2 hr flight minimum)
      scan("Pune, IN", "2026-10-05T03:42:00Z", "09:12"),
      scan("Mumbai, IN", "2026-10-05T03:57:00Z", "09:27"),
      scan("Delhi, IN", "2026-10-05T04:04:00Z", "09:34"),
    ],
    blockchainTxHash: "0x91dc…5e18",
  },
];

// ─── Blockchain transactions ──────────────────────────────────────────────────

export const blockchainTransactions: BlockchainTransaction[] = [
  {
    blockNumber: "18,421",
    hash: "0x7a91…e82c",
    timeAgo: "1 min ago",
    timestamp: "2026-10-05T17:48:00Z",
    event: "Product verified",
    productId: "VC-NIKE-001",
    status: "CONFIRMED",
  },
  {
    blockNumber: "18,422",
    hash: "0x4c30…a921",
    timeAgo: "2 min ago",
    timestamp: "2026-10-05T17:47:00Z",
    event: "Identity confirmed",
    productId: "VC-APPLE-002",
    status: "CONFIRMED",
  },
  {
    blockNumber: "18,423",
    hash: "0x2f81…bc09",
    timeAgo: "3 min ago",
    timestamp: "2026-10-05T17:46:00Z",
    event: "Identity confirmed",
    productId: "VC-SONY-003",
    status: "CONFIRMED",
  },
  {
    blockNumber: "18,424",
    hash: "0x91dc…5e18",
    timeAgo: "4 min ago",
    timestamp: "2026-10-05T17:45:00Z",
    event: "Clone alert raised",
    productId: "VC-FAKE-999",
    status: "CONFIRMED",
  },
];

// ─── Verification history ─────────────────────────────────────────────────────

export const verificationHistory: VerificationHistoryEntry[] = [
  {
    productId: "VC-NIKE-001",
    timeAgo: "2 min ago",
    place: "Portland, US",
    outcome: "AUTHENTIC",
    timestamp: "2026-10-05T17:47:00Z",
  },
  {
    productId: "VC-APPLE-002",
    timeAgo: "8 min ago",
    place: "San Jose, US",
    outcome: "AUTHENTIC",
    timestamp: "2026-10-05T17:41:00Z",
  },
  {
    productId: "VC-SONY-003",
    timeAgo: "15 min ago",
    place: "Singapore",
    outcome: "SUSPICIOUS",
    timestamp: "2026-10-05T17:34:00Z",
  },
  {
    productId: "VC-FAKE-999",
    timeAgo: "23 min ago",
    place: "Delhi, IN",
    outcome: "CLONE SUSPECTED",
    timestamp: "2026-10-05T17:26:00Z",
  },
];

// ─── Alerts ──────────────────────────────────────────────────────────────────

export const alerts: Alert[] = [
  {
    id: "ALT-001",
    severity: "CRITICAL",
    category: "CLONE_DETECTED",
    title: "Possible cloned product detected",
    description:
      "Same product identity scanned across impossible locations within 22 minutes.",
    productId: "VC-FAKE-999",
    timeAgo: "3 min ago",
    timestamp: "2026-10-05T17:46:00Z",
    acknowledged: false,
  },
  {
    id: "ALT-002",
    severity: "HIGH",
    category: "IMPOSSIBLE_LOCATION",
    title: "Impossible location movement",
    description:
      "An identity associated with scans across Singapore and London in a short period.",
    productId: "VC-SONY-003",
    timeAgo: "15 min ago",
    timestamp: "2026-10-05T17:34:00Z",
    acknowledged: false,
  },
  {
    id: "ALT-003",
    severity: "MEDIUM",
    category: "SCAN_FREQUENCY",
    title: "Unusual scan frequency detected",
    description:
      "Repeated requests for the same product identity need an enhanced check.",
    productId: "VC-SONY-003",
    timeAgo: "28 min ago",
    timestamp: "2026-10-05T17:21:00Z",
    acknowledged: false,
  },
  {
    id: "ALT-004",
    severity: "LOW",
    category: "VERIFICATION_COMPLETE",
    title: "Product verification completed",
    description:
      "Manufacturer record and supply-chain trail matched at retail.",
    productId: "VC-NIKE-001",
    timeAgo: "42 min ago",
    timestamp: "2026-10-05T17:07:00Z",
    acknowledged: false,
  },
];

// ─── Supply-chain / provenance records ───────────────────────────────────────

export const provenanceRecords: Record<string, ProvenanceRecord> = {
  "VC-NIKE-001": {
    productId: "VC-NIKE-001",
    productName: "Nike Air Max 2026",
    batchId: "B2026-091",
    integrityVerified: true,
    events: [
      {
        order: 0,
        title: "Manufacturer",
        entityName: "Nike Manufacturing",
        location: "Beaverton, Oregon",
        timestamp: "2026-09-05T08:14:00Z",
        transactionHash: "0x7a91…e82c",
        detail: "Product identity sealed; origin and materials attested.",
        confirmed: true,
      },
      {
        order: 1,
        title: "Distribution",
        entityName: "West Coast Distribution",
        location: "Oakland, California",
        timestamp: "2026-09-08T16:32:00Z",
        transactionHash: "0x23d8…901b",
        detail: "Custody transferred to the authorized regional hub.",
        confirmed: true,
      },
      {
        order: 2,
        title: "Retail partner",
        entityName: "Union Street Sports",
        location: "San Francisco, California",
        timestamp: "2026-09-12T10:06:00Z",
        transactionHash: "0x99a2…10df",
        detail: "Authorized retailer received and checked the sealed batch.",
        confirmed: true,
      },
      {
        order: 3,
        title: "Verified buyer",
        entityName: "Ownership handoff",
        location: "Portland, Oregon",
        timestamp: "2026-09-18T13:42:00Z",
        transactionHash: "0x61ce…13ae",
        detail: "Product identity checked at the time of purchase.",
        confirmed: true,
      },
    ],
  },
};

// ─── Legacy aliases (kept for backward compat during migration) ───────────────

/**
 * @deprecated Import verificationHistory directly.
 */
export const recentActivity = verificationHistory.map((entry) => ({
  productId: entry.productId,
  time: entry.timeAgo,
  place: entry.place,
}));

/**
 * @deprecated Import blockchainTransactions directly.
 */
export const demoTransactions = blockchainTransactions.map((tx) => ({
  block: tx.blockNumber,
  hash: tx.hash,
  timestamp: tx.timeAgo,
  event: tx.event,
  productId: tx.productId,
  status: tx.status,
}));