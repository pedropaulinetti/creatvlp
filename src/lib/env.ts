const read = (key: string): string | undefined => {
  const value = (import.meta.env as Record<string, string | undefined>)[key];
  return value && value.length > 0 ? value : undefined;
};

export const env = {
  supabaseUrl: read("VITE_SUPABASE_URL"),
  supabaseKey: read("VITE_SUPABASE_PUBLISHABLE_KEY"),
  /** Provider fake de IA: só habilitado explicitamente em dev/teste. */
  fakeAi: read("VITE_FAKE_AI") === "true",
  /** Aponta as Edge Functions para outro host. Usado só pelo Playwright. */
  functionsUrl: read("VITE_FUNCTIONS_URL"),
};

export const isSupabaseConfigured = Boolean(env.supabaseUrl && env.supabaseKey);
