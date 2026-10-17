/**
 * Risk service — Phase 1 (mock implementation)
 */
import { products } from "@/lib/mockData";
import { assessRisk } from "@/lib/riskEngine";
import type { ApiResult } from "@/types/api";
import type { RiskAssessment } from "@/types/risk";

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Get the full risk assessment for a product. */
export async function getProductRiskAssessment(
  productId: string
): Promise<ApiResult<RiskAssessment>> {
  await delay(80);

  const product = products.find(
    (p) => p.id.toLowerCase() === productId.toLowerCase()
  );

  if (!product) {
    return {
      ok: false,
      error: `Product "${productId}" not found.`,
      code: 404,
    };
  }

  return { ok: true, data: assessRisk(product.riskFactors) };
}

/** Get risk assessments for all products. */
export async function getAllRiskAssessments(): Promise<
  ApiResult<Array<{ productId: string; productName: string; assessment: RiskAssessment }>>
> {
  await delay(100);

  const data = products.map((p) => ({
    productId: p.id,
    productName: p.name,
    assessment: assessRisk(p.riskFactors),
  }));

  return { ok: true, data };
}
