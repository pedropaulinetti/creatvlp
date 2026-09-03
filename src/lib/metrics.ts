/**
 * Métricas derivadas dos resultados registrados manualmente.
 * Espelha o cálculo da Edge Function `record-performance` para que app e
 * servidor nunca discordem. Divisor zero devolve null, não Infinity.
 */
export type PerformanceInputNumbers = {
  spend_cents: number;
  impressions: number;
  clicks: number;
  leads: number;
  purchases: number;
  revenue_cents: number;
};

export type DerivedMetrics = {
  ctr: number | null;
  cpc_cents: number | null;
  cpm_cents: number | null;
  cpa_cents: number | null;
  cpl_cents: number | null;
  roas: number | null;
  conversion_rate: number | null;
};

const ratio = (value: number, divisor: number): number | null => (divisor > 0 ? value / divisor : null);

export function derivedMetrics(input: PerformanceInputNumbers): DerivedMetrics {
  return {
    ctr: ratio(input.clicks * 100, input.impressions),
    cpc_cents: ratio(input.spend_cents, input.clicks),
    cpm_cents: ratio(input.spend_cents * 1000, input.impressions),
    cpa_cents: ratio(input.spend_cents, input.purchases),
    cpl_cents: ratio(input.spend_cents, input.leads),
    roas: ratio(input.revenue_cents, input.spend_cents),
    conversion_rate: ratio(input.purchases * 100, input.clicks),
  };
}

/** Soma vários relatórios antes de derivar — evita média de médias. */
export function aggregate(reports: PerformanceInputNumbers[]): PerformanceInputNumbers {
  return reports.reduce<PerformanceInputNumbers>(
    (total, report) => ({
      spend_cents: total.spend_cents + report.spend_cents,
      impressions: total.impressions + report.impressions,
      clicks: total.clicks + report.clicks,
      leads: total.leads + report.leads,
      purchases: total.purchases + report.purchases,
      revenue_cents: total.revenue_cents + report.revenue_cents,
    }),
    { spend_cents: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, revenue_cents: 0 },
  );
}

/** Abaixo de 3 relatórios ou 1000 impressões, qualquer diferença é ruído. */
export const MIN_REPORTS_FOR_SIGNAL = 3;
export const MIN_IMPRESSIONS_FOR_SIGNAL = 1000;

export type Confidence = "insuficiente" | "sinal" | "tendencia" | "consistente";

export function confidenceOf(reports: PerformanceInputNumbers[]): Confidence {
  const totals = aggregate(reports);
  if (reports.length < MIN_REPORTS_FOR_SIGNAL || totals.impressions < MIN_IMPRESSIONS_FOR_SIGNAL) {
    return reports.length === 0 ? "insuficiente" : "sinal";
  }
  if (reports.length >= 8 && totals.impressions >= 20_000) return "consistente";
  return "tendencia";
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  insuficiente: "Sem dados suficientes",
  sinal: "Sinal observado",
  tendencia: "Tendência",
  consistente: "Padrão consistente",
};

/** Nunca afirmamos causalidade com amostra pequena. */
export function confidenceCaveat(confidence: Confidence): string {
  switch (confidence) {
    case "insuficiente":
      return "Registre pelo menos um resultado para começar a comparar.";
    case "sinal":
      return "Amostra pequena: trate como sinal observado, não como conclusão. Vale como hipótese para o próximo teste.";
    case "tendencia":
      return "Já dá para ver uma direção, mas mantenha o teste rodando antes de decidir.";
    case "consistente":
      return "Volume suficiente para orientar a próxima rodada com mais segurança.";
  }
}
