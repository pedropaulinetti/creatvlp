import { describe, expect, it } from "vitest";
import { sinalDaConta } from "@/features/admin/ContasTab";

const AGORA = new Date("2026-09-20T12:00:00Z").getTime();
const DIA = 86_400_000;
const atras = (dias: number) => new Date(AGORA - dias * DIA).toISOString();

function conta(over: Partial<Parameters<typeof sinalDaConta>[0]> = {}) {
  return {
    user_id: "u1", full_name: "Teste", email: "t@t.com",
    platform_role: "user" as const, access_status: "ativo" as const, blocked_reason: "",
    joined_at: atras(30), workspace_id: "w1", workspace_name: "W", plan: "beta" as const,
    images_limit: 100, images_used: 10, campaigns_used: 1, bonus_images: 0,
    period_end: null, last_activity: atras(0),
    assets_total: 10, assets_approved: 7, assets_rejected: 3, failed_jobs_7d: 0,
    ...over,
  };
}

describe("o estado de uma conta", () => {
  it("bloqueada vence qualquer outro sinal", () => {
    expect(sinalDaConta(conta({ access_status: "bloqueado", failed_jobs_7d: 9 }), AGORA)).toBe("bloqueado");
  });

  it("duas falhas na semana já contam como falhando", () => {
    expect(sinalDaConta(conta({ failed_jobs_7d: 2 }), AGORA)).toBe("falhando");
    expect(sinalDaConta(conta({ failed_jobs_7d: 1 }), AGORA)).toBe("ativa");
  });

  it("quem entrou há mais de 3 dias e nunca gerou não ativou", () => {
    expect(sinalDaConta(conta({ last_activity: null, joined_at: atras(4) }), AGORA)).toBe("nao_ativou");
  });

  it("quem acabou de entrar e ainda não gerou tem o benefício da dúvida", () => {
    expect(sinalDaConta(conta({ last_activity: null, joined_at: atras(1) }), AGORA)).toBe("ativa");
  });

  it("80% do ciclo é o limiar, e o bônus entra na conta", () => {
    expect(sinalDaConta(conta({ images_used: 80 }), AGORA)).toBe("no_limite");
    expect(sinalDaConta(conta({ images_used: 79 }), AGORA)).toBe("ativa");
    // com 50 de bônus o teto vira 150, e 80 deixa de ser limite
    expect(sinalDaConta(conta({ images_used: 80, bonus_images: 50 }), AGORA)).toBe("ativa");
  });

  it("mais de 7 dias sem gerar é esfriou", () => {
    expect(sinalDaConta(conta({ last_activity: atras(8) }), AGORA)).toBe("esfriou");
    expect(sinalDaConta(conta({ last_activity: atras(6) }), AGORA)).toBe("ativa");
  });

  it("limite aperta antes de esfriar — quem estourou a quota precisa de crédito, não de ligação", () => {
    expect(sinalDaConta(conta({ images_used: 95, last_activity: atras(20) }), AGORA)).toBe("no_limite");
  });

  it("plano sem limite não é tratado como estourado", () => {
    expect(sinalDaConta(conta({ images_limit: 0, images_used: 0 }), AGORA)).toBe("ativa");
  });
});
