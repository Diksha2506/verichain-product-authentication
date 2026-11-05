import { describe, it, expect, vi } from "vitest";
import {
  resolveScannedInput,
  handleScannedInput,
  compareHashPrefix,
  compareHintForRun,
  hintNotice,
  createDecodeGuard,
  getBarcodeDetectorCtor,
  classifyCameraError,
  shouldClearRunningQrNotice,
} from "@/lib/qrScan";
import type { QrHint } from "@/lib/qrScan";
import { QR_HASH_PREFIX_LENGTH } from "@/lib/qr";
import { verifyProduct } from "@/lib/api";

const ID = "VC-NIKE-001";
const FULL_HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f900102030405060708090a0b0c0d0e0f10";
const HASH_PREFIX = FULL_HASH.slice(0, QR_HASH_PREFIX_LENGTH);
const PAYLOAD = `verichain:v1:${ID}?h=${HASH_PREFIX}`;

describe("Scan resolution → verification handoff", () => {
  it("passes a valid QR payload's product ID into the existing verification pipeline", async () => {
    const scan = resolveScannedInput(PAYLOAD);
    expect(scan.ok).toBe(true);
    if (!scan.ok) return;
    expect(scan.isQrPayload).toBe(true);
    expect(scan.productId).toBe(ID);
    // Same entry point as manual verification — no parallel path exists.
    const result = await verifyProduct({ productId: scan.productId });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.productId).toBe(ID);
      expect(result.data.outcome).toBe("AUTHENTIC");
    }
  });

  it("resolves a manual product-ID fallback through the same pipeline", async () => {
    const scan = resolveScannedInput(" vc-sony-003 ");
    expect(scan.ok).toBe(true);
    if (!scan.ok) return;
    expect(scan.isQrPayload).toBe(false);
    const result = await verifyProduct({ productId: scan.productId });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.outcome).toBe("SUSPICIOUS");
  });

  it("rejects malformed QR payloads BEFORE any verification call", () => {
    const start = vi.fn();
    for (const bad of [
      `verichain:v1:${ID}?h=zz`, // bad hash prefix
      `verichain:v2:${ID}?h=${HASH_PREFIX}`, // unsupported version
      `verichain:v1:${ID}?h=${HASH_PREFIX}99`, // oversized prefix
    ]) {
      const scan = handleScannedInput(bad, start);
      expect(scan.ok).toBe(false);
    }
    // No verification may be triggered by any malformed input.
    expect(start).not.toHaveBeenCalled();
  });

  it("hands a valid payload's product ID to the caller's verification starter exactly once", () => {
    const start = vi.fn();
    const scan = handleScannedInput(PAYLOAD, start);
    expect(scan.ok).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith(ID);
  });

  it("rejects plain inputs that fail ProductIdSchema rules", () => {
    expect(resolveScannedInput("   ").ok).toBe(false);
    expect(resolveScannedInput("BAD!ID").ok).toBe(false);
    expect(resolveScannedInput(`VC-${"a".repeat(70)}`).ok).toBe(false);
  });
});

describe("Unsupported scanner capability fallback", () => {
  it("reports no BarcodeDetector in jsdom so the UI uses manual input", () => {
    // jsdom has no BarcodeDetector; null must be handled as graceful fallback.
    expect(getBarcodeDetectorCtor()).toBeNull();
  });

  it("classifies camera failures for user-friendly fallback messaging", () => {
    expect(classifyCameraError({ name: "NotAllowedError" })).toBe("denied");
    expect(classifyCameraError({ name: "NotFoundError" })).toBe("unavailable");
    expect(classifyCameraError({ name: "SomeOtherError" })).toBe("unknown");
    expect(classifyCameraError(null)).toBe("unknown");
  });
});

describe("Duplicate decode protection", () => {
  it("accepts only the first frame decode per scanner session", () => {
    const guard = createDecodeGuard();
    expect(guard()).toBe(true); // first frame scans -> triggers verification
    expect(guard()).toBe(false); // repeat frames suppressed
    expect(guard()).toBe(false);
  });
});

describe("Hash-prefix comparison vs trusted metadata", () => {
  it("matches when the trusted hash starts with the scanned prefix", () => {
    expect(compareHashPrefix(HASH_PREFIX, FULL_HASH)).toBe("match");
  });

  it("flags a mismatch exactly at the first differing character", () => {
    const tampered = FULL_HASH.slice(0, 15) + "9" + FULL_HASH.slice(16); // differs in prefix
    expect(compareHashPrefix(HASH_PREFIX, tampered)).toBe("mismatch");
  });

  it("never claims a match when trusted metadata is unavailable", () => {
    expect(compareHashPrefix(HASH_PREFIX, null)).toBe("unknown");
    expect(compareHashPrefix(HASH_PREFIX, undefined)).toBe("unknown");
    expect(compareHashPrefix(HASH_PREFIX, "")).toBe("unknown");
    expect(compareHashPrefix("", FULL_HASH)).toBe("unknown");
  });
});

describe("Hash-hint run association (audit fix)", () => {
  it("honors a hint only for the verification run it was scanned in", () => {
    expect(compareHintForRun({ runId: 7, hashPrefix: HASH_PREFIX }, 7, FULL_HASH)).toBe("match");
    expect(compareHintForRun({ runId: 7, hashPrefix: HASH_PREFIX }, 8, FULL_HASH)).toBeNull();
  });

  it("never applies a stale run's hint to a newer verification result", () => {
    // Hint tagged with run 3 arrives while run 4 completes: no verdict at all,
    // so the newer run cannot inherit (or be warned by) the older seal.
    expect(compareHintForRun({ runId: 3, hashPrefix: HASH_PREFIX }, 4, FULL_HASH)).toBeNull();
  });

  it("yields no verdict when no hint is stored", () => {
    expect(compareHintForRun(null, 1, FULL_HASH)).toBeNull();
    expect(compareHintForRun(undefined, 1, FULL_HASH)).toBeNull();
  });

  it("keeps 'unknown' — not a match — for a matching run without trusted metadata", () => {
    expect(compareHintForRun({ runId: 5, hashPrefix: HASH_PREFIX }, 5, null)).toBe("unknown");
    expect(compareHintForRun({ runId: 5, hashPrefix: HASH_PREFIX }, 5, "")).toBe("unknown");
  });

  it("still flags mismatches for the matching run", () => {
    const tampered = FULL_HASH.slice(0, 15) + "9" + FULL_HASH.slice(16);
    expect(compareHintForRun({ runId: 9, hashPrefix: HASH_PREFIX }, 9, tampered)).toBe("mismatch");
  });

  it("maps verdicts to distinct user-facing notices", () => {
    expect(hintNotice("match")).toMatch(/^Seal hash prefix matches/);
    expect(hintNotice("mismatch")).toMatch(/does not match/);
    expect(hintNotice("unknown")).toMatch(/could not be checked/);
  });
});

describe("Temporary running-notice cleanup (Phase 6.3 final audit fix)", () => {
  const RUN = 12;

  it("clears the temporary running notice only for the run that owns it", () => {
    expect(shouldClearRunningQrNotice(RUN, RUN)).toBe(true);
  });

  it("never clears the notice on behalf of a newer or older run", () => {
    expect(shouldClearRunningQrNotice(RUN, RUN + 1)).toBe(false);
    expect(shouldClearRunningQrNotice(RUN, RUN - 1)).toBe(false);
  });

  it("treats a missing owner run as nothing to clear", () => {
    expect(shouldClearRunningQrNotice(null, RUN)).toBe(false);
  });

  it("binds clearance to the same monotonic run id the hint uses", () => {
    // A hint from run N must never surface in run N+1, and the temporary
    // notice must follow the identical run-binding rule.
    const hint: QrHint = { runId: RUN, hashPrefix: HASH_PREFIX };
    expect(compareHintForRun(hint, RUN + 1, FULL_HASH)).toBeNull();
    expect(compareHintForRun(hint, RUN, FULL_HASH)).not.toBeNull();
    expect(compareHintForRun(hint, RUN + 1, FULL_HASH)).not.toBe("match");
  });
});
