/**
 * O contrato de streaming, dos dois lados.
 *
 * A leitura do site é a única parte do app que fala por SSE, e o pedaço mais
 * fácil de quebrar sem ninguém notar: o navegador entrega os bytes picados
 * onde quiser, inclusive no meio de um evento.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamEvents } from "../supabase/functions/_shared/stream.ts";
import { errors } from "../supabase/functions/_shared/http.ts";

const getSession = vi.fn(async () => ({ data: { session: { access_token: "token-de-teste" } } }));

vi.mock("@/lib/supabase", () => ({
  requireSupabase: () => ({ auth: { getSession } }),
}));

vi.mock("@/lib/env", () => ({
  env: { supabaseUrl: "https://exemplo.supabase.co", supabaseKey: "chave", functionsUrl: undefined },
}));

const { streamFunction, FunctionError } = await import("@/lib/functions");

/** Serve um corpo SSE partido exatamente nos pedaços informados. */
function respostaComPedacos(pedacos: string[]): Response {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const pedaco of pedacos) controller.enqueue(encoder.encode(pedaco));
        controller.close();
      },
    }),
    { status: 200 },
  );
}

const evento = (dado: unknown) => `data: ${JSON.stringify(dado)}\n\n`;

async function eventosDe(resposta: Response): Promise<unknown[]> {
  const texto = await resposta.text();
  return texto
    .split("\n\n")
    .filter((bloco) => bloco.startsWith("data: "))
    .map((bloco) => JSON.parse(bloco.slice(6)));
}

describe("o lado do servidor", () => {
  it("anuncia cada etapa e fecha com o payload completo", async () => {
    const resposta = streamEvents(async (emitir) => {
      emitir({ tipo: "etapa", etapa: "paleta", estado: "lendo" });
      emitir({ tipo: "etapa", etapa: "paleta", estado: "feito", dados: { cores: ["#B4623A"] } });
      return { analysis: { name: "Marca" } };
    });

    expect(resposta.headers.get("content-type")).toContain("text/event-stream");
    expect(resposta.headers.get("x-accel-buffering")).toBe("no");
    expect(await eventosDe(resposta)).toEqual([
      { tipo: "etapa", etapa: "paleta", estado: "lendo" },
      { tipo: "etapa", etapa: "paleta", estado: "feito", dados: { cores: ["#B4623A"] } },
      { tipo: "pronto", payload: { analysis: { name: "Marca" } } },
    ]);
  });

  it("erro depois do corpo aberto vira evento, não status", async () => {
    const resposta = streamEvents(async () => {
      throw errors.invalid("A página não trouxe conteúdo suficiente.");
    });

    // O status já foi enviado como 200: só o evento pode contar o que houve.
    expect(resposta.status).toBe(200);
    expect(await eventosDe(resposta)).toEqual([
      { tipo: "erro", code: "dados_invalidos", message: "A página não trouxe conteúdo suficiente." },
    ]);
  });

  it("não vaza detalhe interno de erro não previsto", async () => {
    const resposta = streamEvents(async () => {
      throw new Error("connection string postgres://usuario:senha@host");
    });
    const [erro] = (await eventosDe(resposta)) as { code: string; message: string }[];
    expect(erro.code).toBe("erro_interno");
    expect(erro.message).not.toContain("postgres");
  });
});

describe("o lado do navegador", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getSession.mockClear();
  });

  it("remonta evento partido no meio pela rede", async () => {
    const etapa = evento({ tipo: "etapa", etapa: "paleta", estado: "feito", dados: { cores: [] } });
    const pronto = evento({ tipo: "pronto", payload: { ok: true } });

    // O corte cai dentro do JSON da primeira etapa — o pior caso possível.
    const corte = Math.floor(etapa.length / 2);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respostaComPedacos([etapa.slice(0, corte), etapa.slice(corte) + pronto])),
    );

    const vistas: string[] = [];
    const payload = await streamFunction<{ ok: boolean }>(
      "analyze-brand",
      { url: "https://exemplo.com" },
      (item) => vistas.push(`${item.etapa}:${item.estado}`),
    );

    expect(vistas).toEqual(["paleta:feito"]);
    expect(payload).toEqual({ ok: true });
  });

  it("entrega as etapas na ordem, mesmo várias no mesmo pacote", async () => {
    const corpo =
      evento({ tipo: "etapa", etapa: "pagina", estado: "feito" }) +
      evento({ tipo: "etapa", etapa: "estilos", estado: "feito", dados: { folhas: 6 } }) +
      evento({ tipo: "pronto", payload: { ok: 1 } });
    vi.stubGlobal("fetch", vi.fn(async () => respostaComPedacos([corpo])));

    const vistas: string[] = [];
    await streamFunction("analyze-brand", {}, (item) => vistas.push(item.etapa));
    expect(vistas).toEqual(["pagina", "estilos"]);
  });

  it("ignora o comentário que abre o canal", async () => {
    // O ":" inicial existe para o proxy soltar os primeiros bytes; não é evento.
    const corpo = ":\n\n" + evento({ tipo: "etapa", etapa: "pagina", estado: "feito" }) +
      evento({ tipo: "pronto", payload: { ok: true } });
    vi.stubGlobal("fetch", vi.fn(async () => respostaComPedacos([corpo])));

    const vistas: string[] = [];
    const payload = await streamFunction<{ ok: boolean }>("analyze-brand", {}, (i) => vistas.push(i.etapa));
    expect(vistas).toEqual(["pagina"]);
    expect(payload).toEqual({ ok: true });
  });

  it("transforma o evento de erro em falha tratável", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respostaComPedacos([evento({ tipo: "erro", code: "quota_excedida", message: "Sem créditos." })]),
      ),
    );

    await expect(streamFunction("analyze-brand", {}, () => {})).rejects.toMatchObject({
      code: "quota_excedida",
      message: "Sem créditos.",
    });
  });

  it("acusa stream cortado antes do fim, para quem chama poder repetir sem stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respostaComPedacos([evento({ tipo: "etapa", etapa: "pagina", estado: "feito" })])),
    );

    await expect(streamFunction("analyze-brand", {}, () => {})).rejects.toMatchObject({
      code: "stream_incompleto",
    });
  });

  it("preserva o erro em JSON de quando o stream nem chega a abrir", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: { code: "muitas_requisicoes", message: "Aguarde." } }), {
          status: 429,
        }),
      ),
    );

    const falha = await streamFunction("analyze-brand", {}, () => {}).catch((erro: unknown) => erro);
    expect(falha).toBeInstanceOf(FunctionError);
    expect((falha as InstanceType<typeof FunctionError>).code).toBe("muitas_requisicoes");
    expect((falha as InstanceType<typeof FunctionError>).status).toBe(429);
  });
});
