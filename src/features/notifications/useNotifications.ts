import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import type { Database } from "@/lib/database.types";

export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

export function useNotifications() {
  const { workspaceId } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["notifications", workspaceId, user?.id],
    enabled: Boolean(workspaceId && user && supabase),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("notifications")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data ?? [];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase!
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const unread = (query.data ?? []).filter((item) => !item.read_at).map((item) => item.id);
      if (!unread.length) return;
      const { error } = await supabase!
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", unread);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const items = query.data ?? [];
  return {
    items,
    unread: items.filter((item) => !item.read_at).length,
    isLoading: query.isLoading,
    markRead,
    markAllRead,
  };
}
