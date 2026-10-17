/**
 * Product domain types for VeriChain Phase 1.
 * Designed to be compatible with a future FastAPI + PostgreSQL backend.
 */
import type { RiskFactors } from "./risk";

export type ProductStatus = "AUTHENTIC" | "SUSPICIOUS" | "CLONE SUSPECTED";

/** Manufacturer record (will become its own DB table in Phase 2). */
export interface Manufacturer {
  id: string;
  name: string;
  country: string;
  verifiedPartner: boolean;
}

/**
 * Core product identity record.
 * All date fields use ISO-8601 strings for easy JSON serialisation.
 */
export interface Product {
  /** Primary identifier, e.g. "VC-NIKE-001". */
  id: string;
  name: string;
  manufacturer: string;
  manufacturerId?: string;
  batchId: string;
  /** Unique per-unit serial number. */
  serialNumber: string;
  /** SHA-256 hash of the product's on-chain metadata (hex). */
  metadataHash: string;
  status: ProductStatus;
  /** ISO-8601 date string, e.g. "2026-09-05". */
  manufacturedAt: string;
  /** Human-readable formatted date for display. */
  manufacturedDisplay: string;
  /** Snapshot of risk signals, stored for deterministic scoring. */
  riskFactors: RiskFactors;
  /** Recent scan location strings for the clone-detection timeline. */
  recentScans: RecentScan[];
  /** Primary blockchain transaction reference for this product. */
  blockchainTxHash: string;
}

/** A single geographic scan event attached to a product. */
export interface RecentScan {
  location: string;
  /** ISO-8601 datetime string. */
  timestamp: string;
  /** Human-readable relative time for display. */
  timeDisplay: string;
}

// ─── Backward-compat helper ─────────────────────────────────────────────────
/**
 * Maps a RecentScan[] to the legacy "City · time ago" string array
 * so existing UI code keeps working while we migrate.
 */
export const toRecentScanStrings = (scans: RecentScan[]): string[] =>
  scans.map((s) => `${s.location} · ${s.timeDisplay}`);