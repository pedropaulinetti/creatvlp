import { describe, expect, it } from "vitest";
import { derivedMetrics, aggregate, confidenceOf, confidenceCaveat } from "@/lib/metrics";

const base = { spend_cents: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, revenue_cents: 0 };

describe("derivedMetrics", () => {
  it("calcula CTR, CPC e ROAS", () => {
    const metrics = derivedMetrics({
      ...base,
      spend_cents: 100_00,
      impressions: 10_000,
      clicks: 200,
      purchases: 10,
      revenue_cents: 300_00,
    });
    expect(metrics.ctr).toBeCloseTo(2);
    expect(metrics.cpc_cents).toBeCloseTo(50);
    expect(metrics.roas).toBeCloseTo(3);
    expect(metrics.conversion_rate).toBeCloseTo(5);
  });

  it("devolve null em vez de dividir por zero", () => {
    const metrics = derivedMetrics(base);
    expect(metrics.ctr).toBeNull();
    expect(metrics.cpc_cents).toBeNull();
    expect(metrics.roas).toBeNull();
    expect(metrics.cpa_cents).toBeNull();
  });

  it("calcula CPM sobre mil impressões", () => {
    const metrics = derivedMetrics({ ...base, spend_cents: 50_00, impressions: 25_000 });
    expect(metrics.cpm_cents).toBeCloseTo(200);
  });
});

describe("aggregate", () => {
  it("soma antes de derivar, evitando média de médias", () => {
    const totals = aggregate([
      { ...base, spend_cents: 100, impressions: 1000, clicks: 10 },
      { ...base, spend_cents: 300, impressions: 1000, clicks: 90 },
    ]);
    expect(totals.spend_cents).toBe(400);
    expect(totals.impressions).toBe(2000);

    const metrics = derivedMetrics(totals);
    // 100/2000 = 5%, não a média de 1% e 9%.
    expect(metrics.ctr).toBeCloseTo(5);
  });

  it("devolve zeros para lista vazia", () => {
    expect(aggregate([])).toEqual(base);
  });
});

describe("confidenceOf", () => {
  it("chama de insuficiente quando não há registro", () => {
    expect(confidenceOf([])).toBe("insuficiente");
  });

  it("chama de sinal com amostra pequena", () => {
    expect(confidenceOf([{ ...base, impressions: 200 }])).toBe("sinal");
  });

  it("chama de sinal quando há registros mas poucas impressões", () => {
    const reports = Array(5).fill({ ...base, impressions: 50 });
    expect(confidenceOf(reports)).toBe("sinal");
  });

  it("chama de tendência com volume moderado", () => {
    const reports = Array(4).fill({ ...base, impressions: 3000 });
    expect(confidenceOf(reports)).toBe("tendencia");
  });

  it("só chama de consistente com volume alto", () => {
    const reports = Array(10).fill({ ...base, impressions: 5000 });
    expect(confidenceOf(reports)).toBe("consistente");
  });

  it("nunca afirma causalidade com amostra pequena", () => {
    expect(confidenceCaveat("sinal")).toContain("sinal observado");
    expect(confidenceCaveat("sinal")).not.toContain("porque");
  });
});
