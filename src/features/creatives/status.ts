import type { Database } from "@/lib/database.types";

export type AssetStatus = Database["public"]["Enums"]["creative_status"];
export type CampaignStatus = Database["public"]["Enums"]["campaign_status"];

export const ASSET_STATUS: Record<
  AssetStatus,
  { label: string; tone: "neutral" | "accent" | "positive" | "warning" | "danger" | "muted" }
> = {
  rascunho: { label: "Rascunho", tone: "muted" },
  gerando: { label: "Gerando", tone: "accent" },
  revisao: { label: "Para revisar", tone: "warning" },
  aprovado: { label: "Aprovado", tone: "positive" },
  rejeitado: { label: "Rejeitado", tone: "danger" },
  publicado: { label: "Publicado", tone: "neutral" },
  arquivado: { label: "Arquivado", tone: "muted" },
  falhou: { label: "Falhou", tone: "danger" },
};

export const CAMPAIGN_STATUS: Record<
  CampaignStatus,
  { label: string; tone: "neutral" | "accent" | "positive" | "warning" | "muted" }
> = {
  rascunho: { label: "Rascunho", tone: "muted" },
  em_briefing: { label: "Em briefing", tone: "neutral" },
  briefing_confirmado: { label: "Briefing confirmado", tone: "neutral" },
  gerando: { label: "Gerando", tone: "accent" },
  revisao: { label: "Para revisar", tone: "warning" },
  aprovada: { label: "Aprovada", tone: "positive" },
  arquivada: { label: "Arquivada", tone: "muted" },
};
