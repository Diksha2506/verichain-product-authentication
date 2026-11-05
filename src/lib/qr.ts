/**
 * QR payload contract for VeriChain (Phase 6.1).
 *
 * A scanned QR code is only an *input channel*: it names a product and carries
 * a short prefix of that product's metadata hash as a cheap tamper trip-wire.
 * It is never treated as proof of authenticity — every scan is still resolved
 * through the normal verification pipeline (`verifyProduct`), which performs
 * the on-chain hash match and risk-adaptive decision.
 *
 * Format (human-readable, deliberately unambiguous):
 *
 *   verichain:v1:<productId>?h=<hash-prefix>
 *
 * - `<productId>`   accepted by the existing `ProductIdSchema`
 *                   (1–64 chars of [A-Za-z0-9-_], trimmed) — the character
 *                   set excludes "?" and ":", so the split points are unique.
 * - `<hash-prefix>` the first 16 hex characters of the product's metadataHash.
 *
 * This module is independent of UI, camera, and network APIs by design.
 */

import { ProductIdSchema } from "./api/productApi";

export const QR_SCHEME = "verichain";
export const QR_VERSION = "v1";
/** Number of leading hex characters of the metadata hash embedded in the payload. */
export const QR_HASH_PREFIX_LENGTH = 16;
/** Hard ceiling for a raw scanned payload (QR input is untrusted). */
export const QR_MAX_PAYLOAD_LENGTH = 200;

export interface QrPayload {
  version: typeof QR_VERSION;
  productId: string;
  hashPrefix: string;
}

export type QrParseResult =
  | { ok: true; payload: QrPayload }
  | { ok: false; error: string };

const HEX_RE = /^[0-9a-f]+$/;

/**
 * Encode a QR payload for a product.
 *
 * Throws instead of silently degrading: a UI caller should never emit a
 * payload that a scanner would reject or that fabricates a hash. A product
 * without a metadata hash (backend returns an empty string) must not get a QR.
 */
export function encodeQrPayload(productId: string, metadataHash: string): string {
  const idCheck = ProductIdSchema.safeParse(productId);
  if (!idCheck.success) {
    throw new Error(idCheck.error.errors[0]?.message ?? "Invalid product ID.");
  }
  if (metadataHash.length < QR_HASH_PREFIX_LENGTH || !HEX_RE.test(metadataHash)) {
    throw new Error(
      "Product metadata hash is missing or malformed; cannot generate a QR payload."
    );
  }
  const hashPrefix = metadataHash
    .slice(0, QR_HASH_PREFIX_LENGTH)
    .toLowerCase();
  return `${QR_SCHEME}:${QR_VERSION}:${idCheck.data}?h=${hashPrefix}`;
}

/**
 * Strictly parse and validate a scanned QR payload.
 *
 * Rejects empty, oversized, malformed, wrong-scheme, wrong-version payloads
 * and any hash prefix that is not exactly 16 lowercase hex characters.
 * Extra segments or query parameters make the payload ambiguous and are
 * rejected rather than ignored.
 */
export function parseQrPayload(raw: string): QrParseResult {
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, error: "Empty QR payload." };
  }
  if (raw.length > QR_MAX_PAYLOAD_LENGTH) {
    return { ok: false, error: "QR payload exceeds the maximum allowed length." };
  }
  if (raw !== raw.trim()) {
    return { ok: false, error: "QR payload contains surrounding whitespace." };
  }

  const schemeIndex = raw.indexOf(":");
  if (schemeIndex < 0) {
    return { ok: false, error: "QR payload is missing a scheme prefix." };
  }
  if (raw.slice(0, schemeIndex) !== QR_SCHEME) {
    return { ok: false, error: `Unsupported QR scheme (expected "${QR_SCHEME}:").` };
  }

  const rest = raw.slice(schemeIndex + 1);
  const sep = rest.indexOf(":");
  const version = sep < 0 ? "" : rest.slice(0, sep);
  if (version !== QR_VERSION) {
    return { ok: false, error: `Unsupported QR payload version "${version}".` };
  }

  const remaining = rest.slice(sep + 1);
  const queryIndex = remaining.indexOf("?");
  if (queryIndex < 0) {
    return { ok: false, error: 'QR payload is missing the "?h=" hash prefix.' };
  }

  const productId = remaining.slice(0, queryIndex);
  const query = remaining.slice(queryIndex + 1);
  const match = /^h=([0-9a-f]{16})$/.exec(query);
  if (!match) {
    return {
      ok: false,
      error: `QR payload hash prefix must be exactly ${QR_HASH_PREFIX_LENGTH} hex characters after "h=".`,
    };
  }

  // Reuse the same identifier rules as the verification pipeline; no
  // duplicated validation logic, and (e.g.) a 64+-character ID is rejected.
  const idCheck = ProductIdSchema.safeParse(productId);
  if (!idCheck.success) {
    return {
      ok: false,
      error: idCheck.error.errors[0]?.message ?? "Invalid product identifier in QR payload.",
    };
  }

  return {
    ok: true,
    payload: { version: QR_VERSION, productId: idCheck.data, hashPrefix: match[1] ?? "" },
  };
}
