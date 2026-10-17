import { describe, it, expect } from "vitest";
import { getProduct, verifyProduct, VerificationRequestSchema } from "@/lib/api";
import { calculateRiskScore, classifyRiskLevel, assessRisk } from "@/lib/riskEngine";
import { products } from "@/lib/mockData";
import type { RiskFactors } from "@/types/risk";

describe("Product Lookup & Validation", () => {
  it("validates empty or invalid product IDs", () => {
    const emptyResult = VerificationRequestSchema.safeParse({ productId: "   " });
    expect(emptyResult.success).toBe(false);

    const invalidResult = VerificationRequestSchema.safeParse({ productId: "INVALID_!@#" });
    expect(invalidResult.success).toBe(false);

    const validResult = VerificationRequestSchema.safeParse({ productId: "VC-NIKE-001" });
    expect(validResult.success).toBe(true);
  });

  it("returns 404 for unknown product IDs", async () => {
    const result = await getProduct("UNKNOWN-999");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(404);
    }
  });
});

describe("Verification Flow (Demo Products)", () => {
  it("VC-NIKE-001 -> AUTHENTIC / LOW risk", async () => {
    const result = await verifyProduct({ productId: "VC-NIKE-001" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.outcome).toBe("AUTHENTIC");
      expect(result.data.riskAssessment.level).toBe("LOW");
      expect(result.data.verificationLevel).toBe(1);
    }
  });

  it("VC-SONY-003 -> SUSPICIOUS / HIGH risk", async () => {
    const result = await verifyProduct({ productId: "VC-SONY-003" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.outcome).toBe("SUSPICIOUS");
      expect(result.data.riskAssessment.level).toBe("HIGH");
      expect(result.data.verificationLevel).toBe(3);
    }
  });

  it("VC-FAKE-999 -> CLONE SUSPECTED / CRITICAL risk", async () => {
    const result = await verifyProduct({ productId: "VC-FAKE-999" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.outcome).toBe("CLONE SUSPECTED");
      expect(result.data.riskAssessment.level).toBe("CRITICAL");
      expect(result.data.verificationLevel).toBe(3);
    }
  });
});

describe("Risk Classification Boundaries", () => {
  const createFactors = (total: number): RiskFactors => {
    return {
      location: Math.min(30, total),
      duplicateScans: Math.max(0, Math.min(25, total - 30)),
      travel: Math.max(0, Math.min(20, total - 55)),
      supplyChain: Math.max(0, Math.min(15, total - 75)),
      frequency: Math.max(0, Math.min(10, total - 90)),
    };
  };

  const testBoundary = (score: number, expectedLevel: string) => {
    it(`Score ${score} -> ${expectedLevel}`, () => {
      const factors = createFactors(score);
      expect(calculateRiskScore(factors)).toBe(score);
      expect(classifyRiskLevel(score)).toBe(expectedLevel);
    });
  };

  testBoundary(29, "LOW");
  testBoundary(30, "MEDIUM");
  testBoundary(59, "MEDIUM");
  testBoundary(60, "HIGH");
  testBoundary(79, "HIGH");
  testBoundary(80, "CRITICAL");
  testBoundary(100, "CRITICAL");
});
