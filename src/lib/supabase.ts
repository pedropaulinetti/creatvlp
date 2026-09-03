import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env, isSupabaseConfigured } from "@/lib/env";

export type Client = SupabaseClient<Database>;

/**
 * Nos testes ponta a ponta as mesmas Edge Functions sobem localmente com o
 * provider fake. `supabase.functions` é um getter que recria o cliente a cada
 * acesso, então o redirecionamento é feito no fetch.
 */
function functionsAwareFetch(): typeof fetch | undefined {
  const target = env.functionsUrl;
  if (!target) return undefined;
  const base = `${env.supabaseUrl}/functions/v1`;
  return (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.startsWith(base)) {
      return fetch(target + url.slice(base.length), init);
    }
    return fetch(input as RequestInfo, init);
  };
}

export const supabase: Client | null = isSupabaseConfigured
  ? createClient<Database>(env.supabaseUrl!, env.supabaseKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
      global: {
        headers: { "x-client-info": "creatvos-app" },
        ...(functionsAwareFetch() ? { fetch: functionsAwareFetch() } : {}),
      },
    })
  : null;

export { isSupabaseConfigured };

/** Usa quando a ausência de configuração é um erro de programação, não um estado de UI. */
export function requireSupabase(): Client {
  if (!supabase) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no .env.local.",
    );
  }
  return supabase;
}
