import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { errors } from "./http.ts";

export type CreditKind = "campanha" | "imagem";

export async function availableCredits(
  admin: SupabaseClient,
  workspaceId: string,
  kind: CreditKind,
): Promise<number> {
  const { data, error } = await admin.rpc("quota_available", {
    p_workspace: workspaceId,
    p_kind: kind,
  });
  if (error) throw errors.internal("Não foi possível consultar sua quota.");
  return Number(data ?? 0);
}

/** Reserva antes de gastar. Lança erro amigável quando a quota acabou. */
export async function reserveCredits(
  admin: SupabaseClient,
  workspaceId: string,
  kind: CreditKind,
  amount: number,
  jobId?: string,
): Promise<void> {
  const { error } = await admin.rpc("reserve_credits", {
    p_workspace: workspaceId,
    p_kind: kind,
    p_amount: amount,
    p_job: jobId ?? null,
  });

  if (error) {
    if (error.message?.includes("QUOTA_EXCEDIDA")) {
      const available = await availableCredits(admin, workspaceId, kind).catch(() => 0);
      throw errors.quota(
        kind === "imagem"
          ? `Seu plano tem ${Math.max(0, available)} imagem(ns) restante(s) neste ciclo e você pediu ${amount}. Ajuste a quantidade ou troque de plano.`
          : `Seu plano não tem campanhas restantes neste ciclo. Aguarde a renovação ou troque de plano.`,
      );
    }
    throw errors.internal("Não foi possível reservar seus créditos.");
  }
}

export async function confirmCredits(
  admin: SupabaseClient,
  workspaceId: string,
  kind: CreditKind,
  amount: number,
  jobId?: string,
) {
  const { error } = await admin.rpc("confirm_credits", {
    p_workspace: workspaceId,
    p_kind: kind,
    p_amount: amount,
    p_job: jobId ?? null,
  });
  if (error) console.error("falha_confirmar_credito", error.message);
}

/** Devolve o crédito em falha definitiva — nunca cobra o que não entregou. */
export async function refundCredits(
  admin: SupabaseClient,
  workspaceId: string,
  kind: CreditKind,
  amount: number,
  jobId?: string,
  note = "",
) {
  const { error } = await admin.rpc("refund_credits", {
    p_workspace: workspaceId,
    p_kind: kind,
    p_amount: amount,
    p_job: jobId ?? null,
    p_note: note,
  });
  if (error) console.error("falha_devolver_credito", error.message);
}
