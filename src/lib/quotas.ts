/**
 * Cálculo de quota do lado do cliente — só para informar o usuário antes de
 * agir. A decisão real acontece no banco (reserve_credits), que é a fonte de
 * verdade e não pode ser burlada pelo frontend.
 */
export type QuotaSnapshot = {
  images_used: number;
  images_reserved: number;
  campaigns_used: number;
  campaigns_reserved: number;
  bonus_images: number;
  bonus_campaigns: number;
};

export type PlanLimits = {
  images_limit: number;
  campaigns_limit: number;
  brands_limit: number;
  members_limit: number;
};

export type CreditKind = "imagem" | "campanha";

export function available(quota: QuotaSnapshot, plan: PlanLimits, kind: CreditKind): number {
  if (kind === "imagem") {
    return Math.max(0, plan.images_limit + quota.bonus_images - quota.images_used - quota.images_reserved);
  }
  return Math.max(0, plan.campaigns_limit + quota.bonus_campaigns - quota.campaigns_used - quota.campaigns_reserved);
}

export function usedOf(quota: QuotaSnapshot, kind: CreditKind): number {
  return kind === "imagem"
    ? quota.images_used + quota.images_reserved
    : quota.campaigns_used + quota.campaigns_reserved;
}

export function limitOf(quota: QuotaSnapshot, plan: PlanLimits, kind: CreditKind): number {
  return kind === "imagem" ? plan.images_limit + quota.bonus_images : plan.campaigns_limit + quota.bonus_campaigns;
}

export function canAfford(quota: QuotaSnapshot, plan: PlanLimits, kind: CreditKind, amount: number): boolean {
  return amount > 0 && available(quota, plan, kind) >= amount;
}

/** Fração consumida do ciclo, entre 0 e 1. Limite zero conta como esgotado. */
export function usageRatio(quota: QuotaSnapshot, plan: PlanLimits, kind: CreditKind): number {
  const limit = limitOf(quota, plan, kind);
  if (limit <= 0) return 1;
  return Math.min(1, usedOf(quota, kind) / limit);
}

export const NEAR_LIMIT_RATIO = 0.8;

export function isNearLimit(quota: QuotaSnapshot, plan: PlanLimits, kind: CreditKind): boolean {
  return usageRatio(quota, plan, kind) >= NEAR_LIMIT_RATIO;
}

/** Mensagem exibida antes de uma geração cara. */
export function quotaMessage(
  quota: QuotaSnapshot,
  plan: PlanLimits,
  kind: CreditKind,
  amount: number,
): { ok: boolean; message: string } {
  const left = available(quota, plan, kind);
  if (amount <= 0) return { ok: false, message: "Escolha ao menos um item para gerar." };
  if (left >= amount) {
    return {
      ok: true,
      message: `Serão consumidos ${amount} de ${left} ${kind === "imagem" ? "imagens" : "campanhas"} restantes no ciclo.`,
    };
  }
  return {
    ok: false,
    message:
      left === 0
        ? `Você já usou todas as ${kind === "imagem" ? "imagens" : "campanhas"} deste ciclo.`
        : `Restam ${left} e você pediu ${amount}. Reduza a seleção ou troque de plano.`,
  };
}
