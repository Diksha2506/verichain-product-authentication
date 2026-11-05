import { describe, it, expect } from "vitest";
import {
  encodeQrPayload,
  parseQrPayload,
  QR_HASH_PREFIX_LENGTH,
  QR_MAX_PAYLOAD_LENGTH,
} from "@/lib/qr";
import { ProductIdSchema } from "@/lib/api/productApi";
import { products } from "@/lib/mockData";

const ID = "VC-NIKE-001";
const HASH = "a1b2c3d4e5f60718293a4b5c6d7e8f900102030405060708090a0b0c0d0e0f10";

describe("QR payload contract (Phase 6.1)", () => {
  it("round-trips a valid payload", () => {
    const encoded = encodeQrPayload(ID, HASH);
    expect(encoded).toBe(`verichain:v1:${ID}?h=${HASH.slice(0, QR_HASH_PREFIX_LENGTH)}`);

    const parsed = parseQrPayload(encoded);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.payload.version).toBe("v1");
      expect(parsed.payload.productId).toBe(ID);
      expect(parsed.payload.hashPrefix).toBe(HASH.slice(0, QR_HASH_PREFIX_LENGTH));
    }
  });

  it("encodes an ID in mixed case unchanged, and the parser keeps it verbatim", () => {
    const encoded = encodeQrPayload("vc-Nike_01", HASH);
    const parsed = parseQrPayload(encoded);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.payload.productId).toBe("vc-Nike_01");
  });

  it("rejects empty or invalid product IDs when encoding", () => {
    expect(() => encodeQrPayload("", HASH)).toThrow();
    expect(() => encodeQrPayload("   ", HASH)).toThrow();
    expect(() => encodeQrPayload("INVALID_!@#", HASH)).toThrow();
    expect(() => encodeQrPayload("a".repeat(65), HASH)).toThrow();
  });

  it("refuses to encode when the metadata hash is missing, short, or non-hex", () => {
    expect(() => encodeQrPayload(ID, "")).toThrow(/metadata hash/i);
    expect(() => encodeQrPayload(ID, "abc")).toThrow(/metadata hash/i);
    expect(() => encodeQrPayload(ID, "z".repeat(64))).toThrow(/metadata hash/i);
  });

  it("rejects empty and empty-transfer payloads", () => {
    const empty = parseQrPayload("");
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error).toMatch(/empty/i);

    const whitespace = parseQrPayload("   ");
    expect(whitespace.ok).toBe(false);
  });

  it("rejects payloads with surrounding whitespace (extra input)", () => {
    expect(parseQrPayload(` ${encodeQrPayload(ID, HASH)} `).ok).toBe(false);
    expect(parseQrPayload(`\n${encodeQrPayload(ID, HASH)}`).ok).toBe(false);
  });

  it("rejects malformed payloads: no scheme, no hash query, wrong prefix key", () => {
    for (const raw of [
      `${ID}?h=${"a".repeat(16)}`, // no scheme/version at all
      `verichain:v1:${ID}`, // no "?h="
      `verichain:v1:${ID}?${"a".repeat(16)}`, // missing "h=" key
      `verichain:v1:${ID}?H=${"a".repeat(16)}`, // wrong case on key
      `verichain:v1:${ID}?h=${"a".repeat(15)}`, // too-short prefix
      `verichain:v1:${ID}?h=${"a".repeat(17)}`, // over-long prefix
      `verichain:v1:${ID}?h=${"A".repeat(16)}`, // uppercase hex rejected
      `verichain:v1:${ID}?h=${"g".repeat(16)}`, // non-hex characters
    ]) {
      const result = parseQrPayload(raw);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects unsupported versions", () => {
    for (const raw of [
      `verichain:v2:${ID}?h=${"a".repeat(16)}`,
      `verichain:v0:${ID}?h=${"a".repeat(16)}`,
      `verichain::${ID}?h=${"a".repeat(16)}`,
    ]) {
      const result = parseQrPayload(raw);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toMatch(/version/i);
    }
  });

  it("rejects extra or ambiguous segments", () => {
    for (const raw of [
      `verichain:v1:${ID}/extra?h=${"a".repeat(16)}`, // slash after ID
      `verichain:v1:${ID}?h=${"a".repeat(16)}&x=1`, // extra query param
      `verichain:v1:${ID}?h=${"a".repeat(16)}?y=2`, // second query marker
      `otherchain:v1:${ID}?h=${"a".repeat(16)}`, // wrong scheme
      `verichainwx:v1:${ID}?h=${"a".repeat(16)}`, // prefix-sticky scheme
    ]) {
      const result = parseQrPayload(raw);
      expect(result.ok).toBe(false);
    }
  });

  it("rejects payloads that violate ProductIdSchema rules", () => {
    const result = parseQrPayload(`verichain:v1:${"a".repeat(65)}?h=${"a".repeat(16)}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/too long|Product ID/i);

    const illegal = parseQrPayload(`verichain:v1:BAD!ID?h=${"a".repeat(16)}`);
    expect(illegal.ok).toBe(false);
  });

  it("rejects oversized payloads", () => {
    const long = `verichain:v1:${ID}?h=${"a".repeat(QR_MAX_PAYLOAD_LENGTH)}`;
    expect(parseQrPayload(long).ok).toBe(false);

    const over = `verichain:v1:${"a".repeat(64)}?h=${"a".repeat(QR_MAX_PAYLOAD_LENGTH)}`;
    expect(parseQrPayload(over).ok).toBe(false);
  });

  it("stays consistent with the shared ProductIdSchema", () => {
    // Any ID the pipeline accepts must encode; anything schema-invalid must not.
    const borderline = "VC-" + "a".repeat(60); // 63 chars -> valid
    expect(ProductIdSchema.safeParse(borderline).success).toBe(true);
    const parsed = parseQrPayload(encodeQrPayload(borderline, HASH));
    expect(parsed.ok).toBe(true);

    const overlong = `VC-${"a".repeat(61)}`; // 64 chars? still valid; go 65+ to fail
    const invalid = `VC-${"a".repeat(70)}`;
    expect(ProductIdSchema.safeParse(invalid).success).toBe(false);
    expect(parseQrPayload(`verichain:v1:${overlong}?h=${"a".repeat(16)}`).ok).toBe(true);
  });

  it("keeps the parser non-trusting: a valid payload is only an input, not a result", () => {
    // The parser returns data only; verifying authenticity is verifyProduct's job.
    const parsed = parseQrPayload(encodeQrPayload("VC-FAKE-999", HASH));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(typeof parsed.payload.productId).toBe("string");
  });

  it("can encode every product in the demo registry (Phase 6.2 display surface)", () => {
    for (const product of products) {
      const encoded = encodeQrPayload(product.id, product.metadataHash);
      const parsed = parseQrPayload(encoded);
      expect(parsed.ok, `${product.id} payload should parse`).toBe(true);
      if (parsed.ok) {
        expect(parsed.payload.productId).toBe(product.id);
        expect(parsed.payload.hashPrefix).toBe(product.metadataHash.slice(0, QR_HASH_PREFIX_LENGTH).toLowerCase());
      }
    }
  });
});
