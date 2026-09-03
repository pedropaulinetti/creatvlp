import { describe, expect, it } from "vitest";
import { available, canAfford, isNearLimit, quotaMessage, usageRatio, usedOf, limitOf } from "@/lib/quotas";

const beta = { images_limit: 40, campaigns_limit: 4, brands_limit: 1, members_limit: 2 };
const zeroQuota = {
  images_used: 0, images_reserved: 0, campaigns_used: 0, campaigns_reserved: 0,
  bonus_images: 0, bonus_campaigns: 0,
};

describe("available", () => {
  it("desconta usado e reservado", () => {
    const quota = { ...zeroQuota, images_used: 30, images_reserved: 5 };
    expect(available(quota, beta, "imagem")).toBe(5);
  });

  it("soma os créditos extras concedidos pela administração", () => {
    const quota = { ...zeroQuota, images_used: 40, bonus_images: 10 };
    expect(available(quota, beta, "imagem")).toBe(10);
  });

  it("nunca fica negativo", () => {
    const quota = { ...zeroQuota, images_used: 100 };
    expect(available(quota, beta, "imagem")).toBe(0);
  });

  it("trata campanhas separadamente das imagens", () => {
    const quota = { ...zeroQuota, images_used: 40, campaigns_used: 1 };
    expect(available(quota, beta, "imagem")).toBe(0);
    expect(available(quota, beta, "campanha")).toBe(3);
  });
});

describe("canAfford", () => {
  it("permite exatamente o saldo restante", () => {
    const quota = { ...zeroQuota, images_used: 37 };
    expect(canAfford(quota, beta, "imagem", 3)).toBe(true);
    expect(canAfford(quota, beta, "imagem", 4)).toBe(false);
  });

  it("recusa quantidade zero ou negativa", () => {
    expect(canAfford(zeroQuota, beta, "imagem", 0)).toBe(false);
    expect(canAfford(zeroQuota, beta, "imagem", -5)).toBe(false);
  });
});

describe("usageRatio e isNearLimit", () => {
  it("avisa a partir de 80% do ciclo", () => {
    expect(isNearLimit({ ...zeroQuota, images_used: 31 }, beta, "imagem")).toBe(false);
    expect(isNearLimit({ ...zeroQuota, images_used: 32 }, beta, "imagem")).toBe(true);
  });

  it("considera reserva no cálculo", () => {
    expect(usedOf({ ...zeroQuota, images_used: 10, images_reserved: 5 }, "imagem")).toBe(15);
  });

  it("trata limite zero como esgotado", () => {
    const semLimite = { ...beta, images_limit: 0 };
    expect(usageRatio(zeroQuota, semLimite, "imagem")).toBe(1);
    expect(limitOf(zeroQuota, semLimite, "imagem")).toBe(0);
  });
});

describe("quotaMessage", () => {
  it("explica o consumo quando dá para gerar", () => {
    const result = quotaMessage({ ...zeroQuota, images_used: 10 }, beta, "imagem", 4);
    expect(result.ok).toBe(true);
    expect(result.message).toContain("4 de 30");
  });

  it("explica o bloqueio quando o saldo acabou", () => {
    const result = quotaMessage({ ...zeroQuota, images_used: 40 }, beta, "imagem", 2);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("todas as imagens");
  });

  it("sugere reduzir a seleção quando falta pouco", () => {
    const result = quotaMessage({ ...zeroQuota, images_used: 38 }, beta, "imagem", 5);
    expect(result.ok).toBe(false);
    expect(result.message).toContain("Restam 2");
  });
});
