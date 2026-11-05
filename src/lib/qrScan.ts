/**
 * Phase 6.3 — QR scanning helpers.
 *
 * Pure logic for turning a scanned/pasted input into a verification handoff.
 * The camera loop (in src/routes/index.tsx) merely feeds strings here; every
 * security decision lives in these helpers so they are testable without a
 * camera, backend, or blockchain.
 *
 * Security stance: a decoded QR is an untrusted *input*. The embedded hash
 * prefix is only a consistency hint checked against trusted metadata from the
 * existing verification result — parsing or decoding never proves anything,
 * and no verification request is triggered by malformed input.
 */

import { parseQrPayload, QR_SCHEME } from "./qr";
import { ProductIdSchema } from "./api/productApi";

/** Minimal structural typing for the browser BarcodeDetector API (no `any`). */
export interface DetectedBarcode {
  rawValue: string;
}
export interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
export type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

/**
 * Feature-detect BarcodeDetector. Returns null when unsupported so callers can
 * fall back to manual input instead of loading a polyfill or new dependency.
 */
export function getBarcodeDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === "undefined") return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  if (typeof ctor !== "function") return null;
  try {
    const ctorWithType = (ctor as unknown as { getSupportedFormats?: () => Promise<string[]> });
    return typeof ctorWithType?.getSupportedFormats === "function" ? ctor : null;
  } catch {
    return ctor;
  }
}

/** Categorize a getUserMedia failure for the scanner UI. */
export type CameraFailure =
  | "denied"
  | "unavailable"
  | "unknown";

export function classifyCameraError(error: unknown): CameraFailure {
  const name = (error as { name?: string } | null | undefined)?.name;
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return "denied";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") {
    return "unavailable";
  }
  return "unknown";
}

/** Result of translating a scanned/pasted string into a verification handoff. */
export type ScanResolution =
  | { ok: true; productId: string; hashPrefix: string; isQrPayload: boolean }
  | { ok: false; error: string };

/**
 * Resolve raw scanner/paste input. Accepts either a full `verichain:` payload
 * (strictly parsed — malformed QR input never triggers verification) or, for
 * the manual fallback, a plain product identifier validated by the same
 * `ProductIdSchema` used by the verification pipeline.
 */
export function resolveScannedInput(raw: string): ScanResolution {
  const input = raw.trim();
  if (input.startsWith(`${QR_SCHEME}:`)) {
    const parsed = parseQrPayload(input);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    return {
      ok: true,
      productId: parsed.payload.productId,
      hashPrefix: parsed.payload.hashPrefix,
      isQrPayload: true,
    };
  }

  const idCheck = ProductIdSchema.safeParse(input);
  if (!idCheck.success) {
    return {
      ok: false,
      error: idCheck.error.errors[0]?.message ?? "Invalid product identifier.",
    };
  }
  return { ok: true, productId: idCheck.data, hashPrefix: "", isQrPayload: false };
}

/**
 * Compare an untrusted hash prefix from a QR with the trusted metadata hash
 * from an existing verification result. Returns "unknown" when the trusted
 * hash is unavailable — no match is ever claimed from the QR alone.
 */
export type HashPrefixComparison = "match" | "mismatch" | "unknown";

export function compareHashPrefix(
  hashPrefix: string,
  trustedHash: string | null | undefined
): HashPrefixComparison {
  if (!hashPrefix || !trustedHash) return "unknown";
  return trustedHash.slice(0, hashPrefix.length).toLowerCase() === hashPrefix
    ? "match"
    : "mismatch";
}

/**
 * A scanned seal hint stored alongside the identity of the verification run it
 * belongs to, so a pending async completion can never apply one product's seal
 * hint to a different product's later verification.
 */
export interface QrHint {
  runId: number;
  hashPrefix: string;
}

/**
 * Compare a stored hint against the trusted metadata of a verification result,
 * but only when the hint belongs to the verification run that just completed.
 * Returns null when the hint is absent or belongs to a different (stale) run —
 * a hint must never be applied to another product's verification.
 */
export function compareHintForRun(
  hint: QrHint | null | undefined,
  runId: number,
  trustedHash: string | null | undefined
): HashPrefixComparison | null {
  if (!hint || hint.runId !== runId) return null;
  return compareHashPrefix(hint.hashPrefix, trustedHash);
}

/** User-facing notice for a hash-prefix comparison verdict (informational only). */
export function hintNotice(verdict: HashPrefixComparison): string {
  switch (verdict) {
    case "match":
      return "Seal hash prefix matches the verified metadata hash.";
    case "mismatch":
      return "Seal hash prefix does not match the verified on-chain metadata. Treat this seal as untrusted.";
    case "unknown":
      return "Seal hash prefix could not be checked against trusted metadata.";
  }
}

/**
 * Temporary "running the live verification check…" notices set by the QR scan
 * entry point are bound to the verification run they were issued for. A
 * completed run may clear the notice only while it still owns it — a newer
 * run (or a notice belonging to another run) is never touched.
 */
export function shouldClearRunningQrNotice(
  runningNoticeRunId: number | null,
  completedRunId: number
): boolean {
  return runningNoticeRunId !== null && runningNoticeRunId === completedRunId;
}

/**
 * Guard against triggering verification more than once from repeated camera
 * frames of the same QR code. One-time; create a fresh guard per scanner open.
 */
export function createDecodeGuard(): () => boolean {
  let accepted = false;
  return () => {
    if (accepted) return false;
    accepted = true;
    return true;
  };
}

/**
 * Guarded handoff: start verification only when the input resolves cleanly.
 * The UI passes its existing `runVerification`-based starter as `start`;
 * malformed input is rejected before `start` is ever called.
 */
export function handleScannedInput(
  raw: string,
  start: (productId: string) => void
): ScanResolution {
  const resolution = resolveScannedInput(raw);
  if (resolution.ok) start(resolution.productId);
  return resolution;
}

/** Stop every track of a camera stream (idempotent, null-safe). */
export function stopCameraStream(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop());
}
