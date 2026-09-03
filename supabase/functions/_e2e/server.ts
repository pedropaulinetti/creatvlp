/**
 * Servidor local das Edge Functions, usado só pelo Playwright.
 * Roda as MESMAS funções que vão para produção, com FAKE_AI=true — nenhuma
 * chamada paga acontece, e o resto do caminho (auth, RLS, banco, Storage) é real.
 *
 * Fica dentro de supabase/functions para que o Deno use o deno.json de lá
 * (que resolve os npm: pelo cache global, sem tocar no node_modules do npm).
 * O prefixo "_" faz o Supabase ignorar esta pasta na publicação.
 *
 *   cd supabase/functions && deno run --allow-net --allow-env _e2e/server.ts
 */
import { handler as analyzeBrand } from "../analyze-brand/index.ts";
import { handler as campaignChat } from "../campaign-chat/index.ts";
import { handler as generateDirections } from "../generate-directions/index.ts";
import { handler as generateCopies } from "../generate-copies/index.ts";
import { handler as generateImage } from "../generate-image/index.ts";
import { handler as regenerateAsset } from "../regenerate-asset/index.ts";
import { handler as recordPerformance } from "../record-performance/index.ts";
import { handler as recommendNextTest } from "../recommend-next-test/index.ts";
import { handler as adminRetryJob } from "../admin-retry-job/index.ts";
import { handler as runRoutines } from "../run-routines/index.ts";

const ROUTES: Record<string, (request: Request) => Promise<Response>> = {
  "analyze-brand": analyzeBrand,
  "campaign-chat": campaignChat,
  "generate-directions": generateDirections,
  "generate-copies": generateCopies,
  "generate-image": generateImage,
  "regenerate-asset": regenerateAsset,
  "record-performance": recordPerformance,
  "recommend-next-test": recommendNextTest,
  "admin-retry-job": adminRetryJob,
  "run-routines": runRoutines,
};

if (Deno.env.get("FAKE_AI") !== "true") {
  console.error("Recuse-se a subir sem FAKE_AI=true: este servidor é só para testes.");
  Deno.exit(1);
}

const port = Number(Deno.env.get("FUNCTIONS_PORT") ?? "54330");

Deno.serve({ port, onListen: () => console.log(`funções de teste em http://localhost:${port}`) }, (request) => {
  const slug = new URL(request.url).pathname.split("/").filter(Boolean).pop() ?? "";
  const route = ROUTES[slug];
  if (!route) {
    return new Response(JSON.stringify({ error: { code: "nao_encontrada", message: `Função ${slug} não existe.` } }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  return route(request);
});
