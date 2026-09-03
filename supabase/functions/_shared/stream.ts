/**
 * Progresso em tempo real, via Server-Sent Events.
 *
 * A leitura de um site tem etapas de duração muito diferente: baixar as folhas
 * de estilo é rápido, importar um catálogo Shopify não é. Esperar tudo em
 * silêncio faz uma leitura de 20 segundos parecer travada. Aqui cada etapa é
 * anunciada assim que termina, e a tela mostra o que já foi encontrado.
 *
 * O corpo é aberto antes de o trabalho começar, então erro depois disso não
 * pode virar status HTTP: vira um evento `erro`, e o cliente decide o que faz.
 */
import { AppError, CORS_HEADERS } from "./http.ts";

export type Evento =
  /** Uma etapa começou ou terminou. `dados` traz o que ela encontrou. */
  | { tipo: "etapa"; etapa: string; estado: "lendo" | "feito"; dados?: unknown }
  /** Última mensagem do fluxo feliz: o payload completo, igual ao do modo JSON. */
  | { tipo: "pronto"; payload: unknown }
  | { tipo: "erro"; code: string; message: string };

export type Emitir = (evento: Evento) => void;

/** O cliente pede stream pelo Accept; sem isso, a função responde JSON. */
export function querStream(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("text/event-stream");
}

export function streamEvents(executar: (emitir: Emitir) => Promise<unknown>): Response {
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let aberto = true;
      const enviar = (evento: Evento | null) => {
        if (!aberto) return;
        try {
          controller.enqueue(
            encoder.encode(evento ? `data: ${JSON.stringify(evento)}\n\n` : ":\n\n"),
          );
        } catch {
          // Cliente desconectou no meio: parar de escrever é a resposta certa.
          aberto = false;
        }
      };

      /*
       * Um comentário SSE antes de qualquer trabalho.
       *
       * Proxy que acumula resposta só solta os primeiros bytes quando tem o que
       * soltar. Mandar dois bytes na hora zero costuma ser o que faz o canal
       * abrir de verdade em vez de entregar tudo junto no fim.
       */
      enviar(null);

      try {
        const payload = await executar(enviar);
        enviar({ tipo: "pronto", payload });
      } catch (error) {
        const conhecido = error instanceof AppError;
        if (!conhecido) {
          console.error("stream_erro", error instanceof Error ? error.message : String(error));
        }
        enviar({
          tipo: "erro",
          code: conhecido ? error.code : "erro_interno",
          message: conhecido ? error.message : "Algo não deu certo do nosso lado.",
        });
      } finally {
        aberto = false;
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Pede ao proxy que não acumule a resposta antes de repassar.
      "X-Accel-Buffering": "no",
    },
  });
}
