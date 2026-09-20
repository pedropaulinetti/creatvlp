import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { SUPABASE, LIMITS } from "./config.ts";
import { errors } from "./http.ts";

/** Cliente com service role: só existe no servidor, nunca chega ao navegador. */
export function adminClient(): SupabaseClient {
  if (!SUPABASE.url || !SUPABASE.serviceRoleKey) {
    throw errors.internal("Supabase não configurado na Edge Function.");
  }
  return createClient(SUPABASE.url, SUPABASE.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Caller = {
  userId: string;
  email: string | null;
  token: string;
};

/*
 * A conferência de bloqueio mora aqui dentro, e não numa função à parte, de
 * propósito: toda Edge Function que gasta dinheiro passa por `requireUser`.
 * Como guarda separada, bastaria alguém esquecer de chamá-la numa função nova
 * para o bloqueio virar enfeite — e o token de quem foi bloqueado continua
 * válido até expirar, então não dá para confiar só na sessão.
 *
 * Custa uma consulta por requisição. Barato perto de uma geração de imagem.
 */
export async function requireUser(request: Request): Promise<Caller> {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) throw errors.unauthorized();

  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw errors.unauthorized();

  const { data: perfil, error: perfilError } = await admin
    .from("profiles")
    .select("access_status")
    .eq("id", data.user.id)
    .maybeSingle();
  if (perfilError) throw errors.internal();
  if (perfil?.access_status === "bloqueado") {
    throw errors.forbidden("Esta conta está bloqueada. Fale com quem administra o CreatvOS.");
  }

  return { userId: data.user.id, email: data.user.email ?? null, token };
}

export async function requireMembership(
  admin: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<"owner" | "admin" | "member"> {
  const { data, error } = await admin
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw errors.internal();
  if (!data) throw errors.forbidden();
  return data.role;
}

export async function requirePlatformAdmin(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("profiles")
    .select("platform_role")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw errors.internal();
  if (data?.platform_role !== "admin") throw errors.forbidden("Acesso restrito à administração.");
}

/**
 * Rate limit por usuário e workspace, apoiado na própria tabela de jobs.
 * Simples de propósito: não exige infra extra e sobrevive a reinícios.
 */
export async function enforceRateLimit(
  admin: SupabaseClient,
  workspaceId: string,
  userId: string,
) {
  const since = new Date(Date.now() - LIMITS.rateWindowSeconds * 1000).toISOString();
  const { count, error } = await admin
    .from("ai_generation_jobs")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) return;
  if ((count ?? 0) >= LIMITS.rateMaxRequests) throw errors.rateLimit();
}

/** Verifica se a marca pertence mesmo ao workspace informado (evita troca de ID na URL). */
export async function assertBrandInWorkspace(
  admin: SupabaseClient,
  brandId: string,
  workspaceId: string,
) {
  const { data, error } = await admin
    .from("brands")
    .select("id")
    .eq("id", brandId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw errors.internal();
  if (!data) throw errors.forbidden("Marca não encontrada neste workspace.");
}

export async function assertCampaignInWorkspace(
  admin: SupabaseClient,
  campaignId: string,
  workspaceId: string,
) {
  const { data, error } = await admin
    .from("campaigns")
    .select("id, brand_id")
    .eq("id", campaignId)
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw errors.internal();
  if (!data) throw errors.forbidden("Campanha não encontrada neste workspace.");
  return data;
}
