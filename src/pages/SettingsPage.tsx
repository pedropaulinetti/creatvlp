import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Divider, Panel } from "@/components/ui/surface";
import { Field, Input, MonoLabel, Hint } from "@/components/ui/field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/controls";
import { EmptyState, InlineError, LoadingBlock, Notice } from "@/components/ui/states";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { requireSupabase, supabase } from "@/lib/supabase";
import { initials } from "@/lib/utils";
import { isNearLimit, limitOf, usedOf } from "@/lib/quotas";
import { canRenameWorkspace, canInviteMember } from "@/lib/permissions";

export default function SettingsPage() {
  const { user, profile, refreshProfile, signOut, requestPasswordReset } = useAuth();
  const { workspace, workspaceId, quota, plan, role, refresh } = useWorkspace();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = React.useState(profile?.full_name ?? "");
  const [workspaceName, setWorkspaceName] = React.useState(workspace?.name ?? "");
  const [error, setError] = React.useState("");

  React.useEffect(() => setName(profile?.full_name ?? ""), [profile?.full_name]);
  React.useEffect(() => setWorkspaceName(workspace?.name ?? ""), [workspace?.name]);

  const members = useQuery({
    queryKey: ["members", workspaceId],
    enabled: Boolean(workspaceId && supabase),
    queryFn: async () => {
      const { data, error: queryError } = await supabase!
        .from("workspace_members")
        .select("role, user_id, created_at, profile:profiles(full_name, email)")
        .eq("workspace_id", workspaceId!);
      if (queryError) throw queryError;
      return data ?? [];
    },
  });

  const usage = useQuery({
    queryKey: ["usage-summary", workspaceId],
    enabled: Boolean(workspaceId && supabase),
    queryFn: async () => {
      const { data } = await supabase!
        .from("ai_usage_events")
        .select("kind, images, created_at")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
  });

  const saveProfile = useMutation({
    mutationFn: async (value: string) => {
      const client = requireSupabase();
      const { error: saveError } = await client.from("profiles").update({ full_name: value.trim() }).eq("id", user!.id);
      if (saveError) throw saveError;
    },
    onSuccess: async () => {
      await refreshProfile();
      toast.success("Nome atualizado");
    },
    onError: () => setError("Não conseguimos salvar seu nome."),
  });

  const saveWorkspace = useMutation({
    mutationFn: async (value: string) => {
      const client = requireSupabase();
      const { error: saveError } = await client.from("workspaces").update({ name: value.trim() }).eq("id", workspaceId!);
      if (saveError) throw saveError;
    },
    onSuccess: async () => {
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["workspace"] })]);
      toast.success("Workspace atualizado");
    },
    onError: () => setError("Só quem administra o workspace pode renomeá-lo."),
  });

  const imagesLimit = quota && plan ? limitOf(quota, plan, "imagem") : 0;
  const imagesUsed = quota ? usedOf(quota, "imagem") : 0;
  const campaignsLimit = quota && plan ? limitOf(quota, plan, "campanha") : 0;
  const campaignsUsed = quota ? usedOf(quota, "campanha") : 0;
  const nearImageLimit = quota && plan ? isNearLimit(quota, plan, "imagem") : false;
  const memberCount = members.data?.length ?? 0;

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6 px-5 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-1.5">
        <MonoLabel className="text-accent">Configurações</MonoLabel>
        <h1 className="text-[26px] font-normal tracking-[-0.025em] text-ink md:text-[32px]">Conta e workspace</h1>
      </div>

      <InlineError>{error}</InlineError>

      <Tabs defaultValue={window.location.hash === "#consumo" ? "consumo" : "conta"}>
        <TabsList>
          <TabsTrigger value="conta">Conta</TabsTrigger>
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="consumo">Consumo e plano</TabsTrigger>
        </TabsList>

        <TabsContent value="conta" className="flex flex-col gap-5 pt-5">
          <Field label="Nome" htmlFor="profile-name">
            <div className="flex gap-2">
              <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} />
              <Button
                variant="outline"
                onClick={() => saveProfile.mutate(name)}
                disabled={name.trim().length < 2 || name === profile?.full_name}
                loading={saveProfile.isPending}
              >
                Salvar
              </Button>
            </div>
          </Field>

          <Field label="E-mail" htmlFor="profile-email" hint="O e-mail de acesso não pode ser alterado na beta.">
            <Input id="profile-email" value={user?.email ?? ""} disabled />
          </Field>

          <Field label="Senha">
            <Button
              variant="outline"
              className="self-start"
              onClick={async () => {
                if (!user?.email) return;
                try {
                  await requestPasswordReset(user.email);
                  toast.success("Enviamos um link para trocar a senha.");
                } catch {
                  setError("Não conseguimos enviar o link agora.");
                }
              }}
            >
              Trocar senha por e-mail
            </Button>
          </Field>

          <Divider />

          <Button
            variant="quiet"
            className="self-start text-danger hover:bg-danger-soft"
            onClick={() => void signOut().then(() => navigate("/login"))}
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden />
            Sair da conta
          </Button>
        </TabsContent>

        <TabsContent value="workspace" className="flex flex-col gap-5 pt-5">
          <Field label="Nome do workspace" htmlFor="workspace-name">
            <div className="flex gap-2">
              <Input
                id="workspace-name"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                disabled={!canRenameWorkspace(role)}
              />
              <Button
                variant="outline"
                onClick={() => saveWorkspace.mutate(workspaceName)}
                disabled={workspaceName.trim().length < 2 || workspaceName === workspace?.name}
                loading={saveWorkspace.isPending}
              >
                Salvar
              </Button>
            </div>
          </Field>

          <div className="flex flex-col gap-2.5">
            <span className="text-[13px] font-medium text-ink">Pessoas</span>
            {members.isLoading ? (
              <LoadingBlock label="Carregando membros" />
            ) : (
              <div className="flex flex-col">
                {(members.data ?? []).map((member) => {
                  const memberProfile = member.profile as { full_name?: string; email?: string } | null;
                  return (
                    <div key={member.user_id} className="flex items-center gap-3 border-b border-line-soft py-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-line-strong text-[11px] text-ink">
                        {initials(memberProfile?.full_name)}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[13.5px] text-ink">{memberProfile?.full_name ?? "Sem nome"}</span>
                        <span className="truncate text-[12px] text-ink-muted">{memberProfile?.email}</span>
                      </div>
                      <Badge tone="muted" className="ml-auto">
                        {member.role}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
            <Hint>
              O plano {plan?.name} permite até {plan?.members_limit} pessoas
              {plan && !canInviteMember(memberCount, plan.members_limit) && " — o limite já foi atingido"}. Convites
              por e-mail chegam depois da beta.
            </Hint>
          </div>
        </TabsContent>

        <TabsContent value="consumo" className="flex flex-col gap-5 pt-5">
          <Panel className="flex flex-col gap-5 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <MonoLabel>Plano atual</MonoLabel>
              <Badge tone="accent">{plan?.name ?? "—"}</Badge>
              {quota && (
                <span className="ml-auto font-mono text-[11px] text-ink-faint">
                  Ciclo até {new Date(`${quota.period_end}T12:00:00`).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>

            <UsageBar label="Imagens-base" used={imagesUsed} limit={imagesLimit} warn={nearImageLimit} />
            <UsageBar label="Campanhas" used={campaignsUsed} limit={campaignsLimit} />

            <Divider />

            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <dt className="label-mono">Marcas</dt>
                <dd className="text-[15px] text-ink">até {plan?.brands_limit ?? "—"}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="label-mono">Pessoas</dt>
                <dd className="text-[15px] text-ink">até {plan?.members_limit ?? "—"}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="label-mono">Rotinas automáticas</dt>
                <dd className="text-[15px] text-ink">{plan?.auto_routines ? "sim" : "não"}</dd>
              </div>
            </dl>
          </Panel>

          <Notice>
            Na beta fechada não há cobrança. Quando os planos entrarem, o consumo e os limites continuam os mesmos.
          </Notice>

          <div className="flex flex-col gap-2">
            <MonoLabel>Últimas gerações</MonoLabel>
            {usage.isLoading ? (
              <LoadingBlock label="Carregando consumo" />
            ) : !usage.data?.length ? (
              <EmptyState title="Nada consumido ainda" description="O histórico aparece assim que você gerar algo." />
            ) : (
              <div className="flex flex-col">
                {usage.data.slice(0, 20).map((event, index) => (
                  <div key={index} className="flex flex-wrap items-center gap-3 border-b border-line-soft py-2.5">
                    <span className="font-mono text-[11px] text-ink-faint">
                      {new Date(event.created_at).toLocaleString("pt-BR")}
                    </span>
                    <span className="text-[13px] text-ink">{eventLabel(event.kind)}</span>
                    <span className="ml-auto font-mono text-[12px] text-ink-2">{eventCost(event.kind, event.images)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/*
 * O nome interno do evento e o modelo que o atendeu são bastidores: dizem
 * respeito a como a plataforma resolveu o pedido, não ao que o cliente
 * contratou. Aqui fora existe só a unidade que ele compra — o crédito.
 */
const EVENT_LABEL: Record<string, string> = {
  direcoes: "Campanha",
  imagem: "Imagem",
  regeneracao: "Nova imagem",
  regeneracao_copy: "Novo texto",
  copies: "Textos",
  chat: "Conversa",
  analise_marca: "Leitura da marca",
  recomendacao: "Recomendação",
};

function eventLabel(kind: string): string {
  return EVENT_LABEL[kind] ?? kind;
}

function eventCost(kind: string, images: number | null): string {
  const count = Number(images ?? 0);
  if (count > 0) return `${count} ${count === 1 ? "crédito" : "créditos"}`;
  if (kind === "direcoes") return "1 campanha";
  return "sem crédito";
}

function UsageBar({ label, used, limit, warn }: { label: string; used: number; limit: number; warn?: boolean }) {
  const ratio = limit > 0 ? Math.min(1, used / limit) : 0;
  const nearLimit = warn ?? ratio >= 0.8;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-3">
        <span className="text-[13.5px] text-ink">{label}</span>
        <span className="ml-auto font-mono text-[12px] text-ink-2">
          {used} / {limit}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
        <div
          className={`h-1.5 rounded-full transition-[width] ${nearLimit ? "bg-accent" : "bg-ink"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      {nearLimit && (
        <Hint>
          {ratio >= 1 ? "Limite atingido neste ciclo." : "Você já passou de 80% do ciclo."}
        </Hint>
      )}
    </div>
  );
}
