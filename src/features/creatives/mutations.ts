import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { requireSupabase } from "@/lib/supabase";
import { callFunction, functionErrorMessage } from "@/lib/functions";
import { uploadBlob } from "@/lib/storage";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import type { Database } from "@/lib/database.types";
import type { ImageQuality } from "@/lib/image-quality";

type AssetStatus = Database["public"]["Enums"]["creative_status"];

function useInvalidate() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["campaign"] }),
      queryClient.invalidateQueries({ queryKey: ["library"] }),
      queryClient.invalidateQueries({ queryKey: ["home-signals"] }),
      queryClient.invalidateQueries({ queryKey: ["quota"] }),
    ]);
}

export function useAssetActions() {
  const invalidate = useInvalidate();
  const { workspaceId } = useWorkspace();

  const setStatus = useMutation({
    mutationFn: async ({ ids, status, reason }: { ids: string[]; status: AssetStatus; reason?: string }) => {
      const client = requireSupabase();
      const { error } = await client
        .from("creative_assets")
        .update({ status, rejection_reason: reason ?? null })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: async (_data, variables) => {
      await invalidate();
      const count = variables.ids.length;
      const labels: Partial<Record<AssetStatus, string>> = {
        aprovado: count > 1 ? `${count} criativos aprovados` : "Criativo aprovado",
        rejeitado: count > 1 ? `${count} criativos rejeitados` : "Criativo rejeitado",
        publicado: "Marcado como publicado",
        arquivado: count > 1 ? `${count} criativos arquivados` : "Criativo arquivado",
      };
      toast.success(labels[variables.status] ?? "Status atualizado");
    },
    onError: () => toast.error("Não conseguimos atualizar o status. Tente de novo."),
  });

  const toggleFavorite = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const client = requireSupabase();
      const { error } = await client.from("creative_assets").update({ is_favorite: value }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Exclusão recuperável: o arquivo continua no Storage. */
  const softDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const client = requireSupabase();
      const { error } = await client
        .from("creative_assets")
        .update({ deleted_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: async (_data, ids) => {
      await invalidate();
      toast.success(ids.length > 1 ? `${ids.length} criativos movidos para a lixeira` : "Criativo movido para a lixeira");
    },
  });

  const restore = useMutation({
    mutationFn: async (ids: string[]) => {
      const client = requireSupabase();
      const { error } = await client.from("creative_assets").update({ deleted_at: null }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Criativo restaurado");
    },
  });

  const moveToFolder = useMutation({
    mutationFn: async ({ ids, folderId }: { ids: string[]; folderId: string | null }) => {
      const client = requireSupabase();
      const { error } = await client.from("creative_assets").update({ folder_id: folderId }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Criativos movidos");
    },
  });

  const updateComposition = useMutation({
    mutationFn: async ({
      id,
      composition,
      templateKey,
    }: {
      id: string;
      composition: unknown;
      templateKey?: string;
    }) => {
      const client = requireSupabase();
      const { error } = await client
        .from("creative_assets")
        .update({
          composition: composition as never,
          ...(templateKey ? { template_key: templateKey } : {}),
          // O render anterior deixa de valer quando a composição muda.
          render_path: null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Não conseguimos salvar a composição."),
  });

  const regenerate = useMutation({
    mutationFn: async ({
      assetId,
      mode,
      quality,
    }: {
      assetId: string;
      mode: "imagem" | "copy" | "ambos" | "peca";
      quality?: ImageQuality;
    }) => {
      return callFunction("regenerate-asset", {
        workspace_id: workspaceId,
        asset_id: assetId,
        mode,
        ...(quality ? { quality } : {}),
      });
    },
    onSuccess: async (_data, variables) => {
      await invalidate();
      toast.success(
        variables.mode === "copy"
          ? "Texto reescrito"
          : variables.mode === "peca"
            ? "Peça redesenhada"
            : "Criativo regenerado",
      );
    },
    onError: (error) => toast.error(functionErrorMessage(error)),
  });

  /** Guarda o PNG composto para reaproveitar em downloads e exportações. */
  const saveRender = useMutation({
    mutationFn: async ({ id, brandId, blob }: { id: string; brandId: string; blob: Blob }) => {
      if (!workspaceId) throw new Error("Workspace não carregado");
      const path = await uploadBlob({
        bucket: "creative-assets",
        workspaceId,
        brandId,
        resourceType: "render",
        blob,
      });
      const client = requireSupabase();
      const { error } = await client.from("creative_assets").update({ render_path: path }).eq("id", id);
      if (error) throw error;
      return path;
    },
  });

  return { setStatus, toggleFavorite, softDelete, restore, moveToFolder, updateComposition, regenerate, saveRender };
}

export function useDirectionActions() {
  const invalidate = useInvalidate();
  const { workspaceId } = useWorkspace();

  const setStatus = useMutation({
    mutationFn: async ({
      id,
      status,
      reason,
    }: {
      id: string;
      status: Database["public"]["Enums"]["direction_status"];
      reason?: string;
    }) => {
      const client = requireSupabase();
      const { error } = await client
        .from("creative_directions")
        .update({ status, rejection_reason: reason ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Database["public"]["Tables"]["creative_directions"]["Update"];
    }) => {
      const client = requireSupabase();
      const { error } = await client.from("creative_directions").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Caminho atualizado");
    },
  });

  const updateCopy = useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Database["public"]["Tables"]["creative_copies"]["Update"];
    }) => {
      const client = requireSupabase();
      const { error } = await client.from("creative_copies").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success("Copy atualizada");
    },
  });

  const moreCopies = useMutation({
    mutationFn: async (directionId: string) =>
      callFunction("generate-copies", { workspace_id: workspaceId, direction_id: directionId, count: 3 }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Novas copies geradas");
    },
    onError: (error) => toast.error(functionErrorMessage(error)),
  });

  return { setStatus, update, updateCopy, moreCopies };
}
