import { useMutation, useQueryClient } from "@tanstack/react-query";
import { requireSupabase } from "@/lib/supabase";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";

export const TIPOS_DE_FEEDBACK = [
  { value: "sugestao", label: "Sugestão" },
  { value: "problema", label: "Algo quebrado" },
  { value: "elogio", label: "Elogio" },
] as const;

export type TipoDeFeedback = (typeof TIPOS_DE_FEEDBACK)[number]["value"];

export const TIPO_LABEL: Record<string, string> = {
  sugestao: "Sugestão",
  problema: "Algo quebrado",
  elogio: "Elogio",
};

export const LIMITE_DE_CARACTERES = 4000;

/**
 * O caminho vai junto com o texto porque a frase que a pessoa escreve quase
 * nunca diz em que tela ela estava, e sem isso a sugestão vira adivinhação.
 */
export function useEnviarFeedback() {
  const { user } = useAuth();
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ kind, message }: { kind: TipoDeFeedback; message: string }) => {
      const supabase = requireSupabase();
      const { error } = await supabase.from("feedback").insert({
        workspace_id: workspaceId,
        user_id: user?.id ?? null,
        kind,
        message: message.trim().slice(0, LIMITE_DE_CARACTERES),
        path: `${window.location.pathname}${window.location.search}`,
        context: {
          agent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-feedback"] }),
  });
}
