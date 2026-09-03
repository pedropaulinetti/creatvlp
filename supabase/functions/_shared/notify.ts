import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type NotificationKind =
  | "campanha_pronta" | "criativos_aguardando" | "rotina_executada" | "rotina_erro"
  | "geracao_falhou" | "limite_proximo" | "limite_atingido" | "marca_atualizada";

export async function notify(
  admin: SupabaseClient,
  params: {
    workspaceId: string;
    userId?: string | null;
    kind: NotificationKind;
    title: string;
    body?: string;
    link?: string;
  },
) {
  const { error } = await admin.from("notifications").insert({
    workspace_id: params.workspaceId,
    user_id: params.userId ?? null,
    kind: params.kind,
    title: params.title,
    body: params.body ?? "",
    link: params.link ?? null,
  });
  if (error) console.error("falha_notificar", error.message);
}

/** Avisa quando o consumo passa de 80% e quando o limite acaba. */
export async function notifyQuotaThreshold(
  admin: SupabaseClient,
  workspaceId: string,
  userId: string | null,
) {
  const { data: quota } = await admin
    .from("usage_quotas")
    .select("plan, images_used, images_reserved, bonus_images")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!quota) return;

  const { data: plan } = await admin
    .from("plans")
    .select("images_limit")
    .eq("key", quota.plan)
    .maybeSingle();
  if (!plan) return;

  const limit = plan.images_limit + (quota.bonus_images ?? 0);
  if (limit <= 0) return;
  const used = quota.images_used + quota.images_reserved;
  const ratio = used / limit;

  if (ratio >= 1) {
    await notify(admin, {
      workspaceId,
      userId,
      kind: "limite_atingido",
      title: "Você usou todas as imagens do ciclo",
      body: `São ${limit} imagens por mês no seu plano. O ciclo reinicia no começo do próximo mês.`,
      link: "/app/configuracoes",
    });
  } else if (ratio >= 0.8) {
    await notify(admin, {
      workspaceId,
      userId,
      kind: "limite_proximo",
      title: "Você já usou 80% das imagens do ciclo",
      body: `${used} de ${limit} imagens usadas neste mês.`,
      link: "/app/configuracoes",
    });
  }
}
