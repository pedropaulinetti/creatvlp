/**
 * Declarações mínimas para type-checar, no ambiente do Vitest, os módulos
 * compartilhados das Edge Functions (que rodam em Deno).
 * O type-check real desses arquivos é feito por `deno check` — veja `npm run check:functions`.
 */
declare const Deno: {
  env: { get(key: string): string | undefined };
  resolveDns?: (hostname: string, recordType: string) => Promise<string[]>;
  serve?: (handler: (request: Request) => Response | Promise<Response>) => void;
};

declare module "npm:zod@3.23.8" {
  export * from "zod";
}

declare module "npm:@supabase/supabase-js@2" {
  export * from "@supabase/supabase-js";
}
