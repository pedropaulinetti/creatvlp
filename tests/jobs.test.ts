/**
 * Job que morreu no meio não pode travar a campanha para sempre.
 *
 * Era o que acontecia: função reiniciada durante a geração deixava o job em
 * "processing", e toda tentativa seguinte recebia "muitas solicitações
 * seguidas" — uma mensagem que não descreve o problema e da qual não havia
 * saída, nem esperando.
 */
import { describe, expect, it } from "vitest";
import {
  openJob, chaveDosCaminhos, TETO_DA_FUNCAO_MS, TEMPO_ATE_ABANDONO_MS,
} from "../supabase/functions/_shared/jobs.ts";

/** Cliente mínimo do Supabase: só o que o openJob usa. */
function clienteFalso(existente: Record<string, unknown> | null) {
  const atualizacoes: Record<string, unknown>[] = [];
  const cliente = {
    from() {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: existente }) }),
            maybeSingle: async () => ({ data: existente }),
          }),
        }),
        update(valores: Record<string, unknown>) {
          atualizacoes.push(valores);
          return { eq: async () => ({ data: null, error: null }) };
        },
        insert: () => ({
          select: () => ({ single: async () => ({ data: { id: "novo" }, error: null }) }),
        }),
      };
    },
    rpc: async () => ({ data: null, error: null }),
  };
  return { cliente, atualizacoes };
}

const base = {
  workspaceId: "w1",
  userId: "u1",
  kind: "direcoes" as const,
  idempotencyKey: "chave",
};

const agora = () => new Date().toISOString();
const minutosAtras = (n: number) => new Date(Date.now() - n * 60_000).toISOString();

describe("openJob e o job travado", () => {
  it("recusa quando a geração está mesmo em curso", async () => {
    const { cliente } = clienteFalso({ id: "j1", status: "processing", started_at: agora(), credits_reserved: 0 });
    /*
     * Código próprio, e não o do rate limit: aqui não adianta pedir mais
     * devagar, adianta esperar. A mensagem diz quantos segundos faltam.
     */
    await expect(openJob(cliente as never, base)).rejects.toMatchObject({ code: "geracao_em_curso" });
  });

  it("retoma o job que ficou parado tempo demais", async () => {
    const { cliente } = clienteFalso({
      id: "j1", status: "processing", started_at: minutosAtras(30), credits_reserved: 0,
    });
    const job = await openJob(cliente as never, base);
    expect(job.id).toBe("j1");
    expect(job.reused).toBe(false);
  });

  it("job sem hora de início conta como abandonado, não como em curso", async () => {
    const { cliente } = clienteFalso({ id: "j1", status: "processing", started_at: null, credits_reserved: 0 });
    await expect(openJob(cliente as never, base)).resolves.toMatchObject({ reused: false });
  });

  it("reaproveita o resultado do job que terminou", async () => {
    const { cliente } = clienteFalso({ id: "j1", status: "completed", output: { ok: 1 }, started_at: agora() });
    const job = await openJob(cliente as never, base);
    expect(job.reused).toBe(true);
    expect(job.output).toEqual({ ok: 1 });
  });
});

/**
 * "Novos caminhos" precisa gerar caminhos novos.
 *
 * A chave por versão do briefing protege o clique duplo e a função reiniciada
 * no meio — mas era ela também que devolvia, calada, os mesmos caminhos de
 * sempre quando a pessoa pedia outros: o job anterior já estava "completed" e
 * `openJob` reaproveitava o resultado sem chamar o modelo.
 */
describe("a chave da geração de caminhos", () => {
  it("é a mesma quando é a mesma tentativa — clique duplo não gera duas vezes", () => {
    expect(chaveDosCaminhos("c1", 2)).toBe(chaveDosCaminhos("c1", 2));
  });

  it("muda quando o briefing ganha uma versão nova", () => {
    expect(chaveDosCaminhos("c1", 2)).not.toBe(chaveDosCaminhos("c1", 3));
  });

  it("obedece à chave pedida pelo app: é assim que 'Novos caminhos' gera de novo", () => {
    expect(chaveDosCaminhos("c1", 2, "direcoes:c1:novos:1756000000000")).not.toBe(chaveDosCaminhos("c1", 2));
  });

  it("chave vazia não vale: volta a ser a do briefing", () => {
    expect(chaveDosCaminhos("c1", 2, "   ")).toBe(chaveDosCaminhos("c1", 2));
  });
});

/**
 * "Muitas solicitações seguidas" quando não havia solicitação nenhuma.
 *
 * Job que morreu no meio ficava "processing", e toda nova tentativa levava o
 * mesmo 429 do rate limit. A mensagem dizia que a pessoa estava rápida demais
 * quando o problema era o contrário, e não dizia como sair. O tempo até dar o
 * job por abandonado passou a sair do teto da própria função: depois dele, não
 * há mais ninguém do outro lado.
 */
describe("tempo até dar o job por abandonado", () => {
  it("sai do teto da função, com folga, em vez de um número redondo", () => {
    expect(TETO_DA_FUNCAO_MS).toBe(150_000);
    // Cobre o teto inteiro e sobra meio minuto.
    expect(TEMPO_ATE_ABANDONO_MS).toBeGreaterThan(TETO_DA_FUNCAO_MS);
    // E é bem menor que os 5 minutos antigos, que era tempo travado à toa.
    expect(TEMPO_ATE_ABANDONO_MS).toBeLessThan(5 * 60_000);
  });

  it("a mensagem diz quanto falta, em vez de mandar aguardar", async () => {
    const { cliente } = clienteFalso({ id: "j1", status: "processing", started_at: agora(), credits_reserved: 0 });
    await expect(openJob(cliente as never, base)).rejects.toThrow(/ainda está em andamento/);
    await expect(openJob(cliente as never, base)).rejects.toThrow(/\d+s/);
  });
});
