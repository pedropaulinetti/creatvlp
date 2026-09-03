import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Database } from "@/lib/database.types";

export type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];
export type Brand = Database["public"]["Tables"]["brands"]["Row"];
export type Quota = Database["public"]["Tables"]["usage_quotas"]["Row"];
export type Plan = Database["public"]["Tables"]["plans"]["Row"];
export type MemberRole = Database["public"]["Enums"]["member_role"];

const BRAND_STORAGE_KEY = "creatvos:brand";

type WorkspaceState = {
  loading: boolean;
  error: Error | null;
  workspace: Workspace | null;
  workspaceId: string | null;
  role: MemberRole | null;
  brands: Brand[];
  brand: Brand | null;
  brandId: string | null;
  quota: Quota | null;
  plan: Plan | null;
  selectBrand: (brandId: string) => void;
  refresh: () => Promise<void>;
};

const WorkspaceContext = React.createContext<WorkspaceState | null>(null);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const queryClient = useQueryClient();
  const [brandId, setBrandId] = React.useState<string | null>(
    () => localStorage.getItem(BRAND_STORAGE_KEY),
  );

  const enabled = Boolean(ready && user && supabase);

  const membership = useQuery({
    queryKey: ["workspace", user?.id],
    enabled,
    staleTime: 60_000,
    queryFn: async () => {
      const client = supabase!;
      const { data, error } = await client
        .from("workspace_members")
        .select("role, workspace:workspaces(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as { role: MemberRole; workspace: Workspace } | null;
    },
  });

  const workspace = membership.data?.workspace ?? null;
  const workspaceId = workspace?.id ?? null;

  const brands = useQuery({
    queryKey: ["brands", workspaceId],
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
    queryFn: async () => {
      const client = supabase!;
      const { data, error } = await client
        .from("brands")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const quota = useQuery({
    queryKey: ["quota", workspaceId],
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
    queryFn: async () => {
      const client = supabase!;
      const [quotaResult, planResult] = await Promise.all([
        client.from("usage_quotas").select("*").eq("workspace_id", workspaceId!).maybeSingle(),
        client.from("plans").select("*"),
      ]);
      if (quotaResult.error) throw quotaResult.error;
      if (planResult.error) throw planResult.error;
      const current = quotaResult.data ?? null;
      const plan = planResult.data?.find((item) => item.key === (current?.plan ?? workspace?.plan)) ?? null;
      return { quota: current, plan };
    },
  });

  const brandList = React.useMemo(() => brands.data ?? [], [brands.data]);

  const activeBrand = React.useMemo(() => {
    if (!brandList.length) return null;
    return brandList.find((item) => item.id === brandId) ?? brandList[0];
  }, [brandList, brandId]);

  React.useEffect(() => {
    if (activeBrand && activeBrand.id !== brandId) {
      setBrandId(activeBrand.id);
      localStorage.setItem(BRAND_STORAGE_KEY, activeBrand.id);
    }
  }, [activeBrand, brandId]);

  const selectBrand = React.useCallback((next: string) => {
    setBrandId(next);
    localStorage.setItem(BRAND_STORAGE_KEY, next);
  }, []);

  const refresh = React.useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["workspace"] }),
      queryClient.invalidateQueries({ queryKey: ["brands"] }),
      queryClient.invalidateQueries({ queryKey: ["quota"] }),
    ]);
  }, [queryClient]);

  const value = React.useMemo<WorkspaceState>(
    () => ({
      loading: enabled && (membership.isLoading || brands.isLoading),
      error: (membership.error as Error | null) ?? (brands.error as Error | null) ?? null,
      workspace,
      workspaceId,
      role: membership.data?.role ?? null,
      brands: brandList,
      brand: activeBrand,
      brandId: activeBrand?.id ?? null,
      quota: quota.data?.quota ?? null,
      plan: quota.data?.plan ?? null,
      selectBrand,
      refresh,
    }),
    [
      enabled,
      membership.isLoading,
      membership.error,
      membership.data,
      brands.isLoading,
      brands.error,
      workspace,
      workspaceId,
      brandList,
      activeBrand,
      quota.data,
      selectBrand,
      refresh,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = React.useContext(WorkspaceContext);
  if (!context) throw new Error("useWorkspace precisa estar dentro de <WorkspaceProvider>");
  return context;
}

/** Uso interno das telas que já passaram pelas guardas: workspace garantido. */
export function useWorkspaceId() {
  const { workspaceId } = useWorkspace();
  if (!workspaceId) throw new Error("Workspace ainda não carregado");
  return workspaceId;
}
