import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import type { Database } from "@/lib/database.types";

export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type CreativeAsset = Database["public"]["Tables"]["creative_assets"]["Row"];
export type Direction = Database["public"]["Tables"]["creative_directions"]["Row"];
export type Copy = Database["public"]["Tables"]["creative_copies"]["Row"];
export type Routine = Database["public"]["Tables"]["routines"]["Row"];

/** Sinais da tela inicial: o mínimo que exige atenção hoje. */
export function useHomeSignals() {
  const { workspaceId, brandId } = useWorkspace();

  return useQuery({
    queryKey: ["home-signals", workspaceId, brandId],
    enabled: Boolean(workspaceId && brandId && supabase),
    staleTime: 15_000,
    queryFn: async () => {
      const client = supabase!;
      const [awaiting, producing, routine, lastLearning] = await Promise.all([
        client
          .from("creative_assets")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", workspaceId!)
          .eq("brand_id", brandId!)
          .eq("status", "revisao")
          .is("deleted_at", null),
        client
          .from("campaigns")
          .select("id, name, status")
          .eq("workspace_id", workspaceId!)
          .eq("brand_id", brandId!)
          .in("status", ["gerando", "revisao", "briefing_confirmado"])
          .is("deleted_at", null)
          .order("updated_at", { ascending: false })
          .limit(4),
        client
          .from("routines")
          .select("id, name, next_run_at, run_at, frequency, weekday")
          .eq("workspace_id", workspaceId!)
          .eq("brand_id", brandId!)
          .eq("status", "ativa")
          .is("deleted_at", null)
          .not("next_run_at", "is", null)
          .order("next_run_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        client
          .from("brand_learnings")
          .select("statement, confidence, created_at")
          .eq("workspace_id", workspaceId!)
          .eq("brand_id", brandId!)
          .eq("kind", "proximo_teste")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        awaitingApproval: awaiting.count ?? 0,
        producing: producing.data ?? [],
        nextRoutine: routine.data ?? null,
        nextTest: lastLearning.data ?? null,
      };
    },
  });
}

export function useCampaigns(filters: { status?: string; search?: string } = {}) {
  const { workspaceId, brandId } = useWorkspace();

  return useQuery({
    queryKey: ["campaigns", workspaceId, brandId, filters.status, filters.search],
    enabled: Boolean(workspaceId && brandId && supabase),
    queryFn: async () => {
      let query = supabase!
        .from("campaigns")
        .select("*, briefs:campaign_briefs(payload, confirmed_at), assets:creative_assets(count)")
        .eq("workspace_id", workspaceId!)
        .eq("brand_id", brandId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(60);

      if (filters.status && filters.status !== "todas") {
        query = query.eq("status", filters.status as Campaign["status"]);
      }
      if (filters.search?.trim()) {
        query = query.ilike("name", `%${filters.search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCampaign(campaignId: string | undefined) {
  const { workspaceId } = useWorkspace();

  return useQuery({
    queryKey: ["campaign", campaignId],
    enabled: Boolean(campaignId && workspaceId && supabase),
    queryFn: async () => {
      const client = supabase!;
      const [campaign, brief, directions, assets, reports] = await Promise.all([
        client.from("campaigns").select("*").eq("id", campaignId!).is("deleted_at", null).maybeSingle(),
        client
          .from("campaign_briefs")
          .select("*")
          .eq("campaign_id", campaignId!)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from("creative_directions")
          .select("*, copies:creative_copies(*)")
          .eq("campaign_id", campaignId!)
          .order("position", { ascending: true }),
        client
          .from("creative_assets")
          .select("*, variants:creative_variants(*)")
          .eq("campaign_id", campaignId!)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        client
          .from("performance_reports")
          .select("*")
          .eq("campaign_id", campaignId!)
          .order("period_start", { ascending: false }),
      ]);

      if (campaign.error) throw campaign.error;
      if (!campaign.data) throw new Error("Campanha não encontrada");

      return {
        campaign: campaign.data,
        brief: brief.data,
        directions: directions.data ?? [],
        assets: assets.data ?? [],
        reports: reports.data ?? [],
      };
    },
  });
}
