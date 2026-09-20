import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ExternalLink, RefreshCw, Search } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge, Divider, Panel } from "@/components/ui/surface";
import { Input, MonoLabel } from "@/components/ui/field";
import { Select, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/controls";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { EmptyState, ErrorState, LoadingBlock, InlineError } from "@/components/ui/states";
import { useAuth } from "@/features/auth/AuthProvider";
import { requireSupabase, supabase } from "@/lib/supabase";
import { callFunction, functionErrorMessage } from "@/lib/functions";
import { formatUSD, formatInt, initials } from "@/lib/utils";
import { ContasTab } from "@/features/admin/ContasTab";
import { diagnosisSteps } from "@/legacy/pages.jsx";

type ResearchRow = {
  id: string;
  created_at: string;
  nome: string;
  empresa: string;
  telefone: string;
  email: string;
  status: string;
  respostas: Record<string, string | string[]>;
};

const FEEDBACK_KIND: Record<string, string> = {
  sugestao: "Sugestão",
  problema: "Algo quebrado",
  elogio: "Elogio",
};

/** Jobs parados em "processing" há mais de 10 minutos são considerados travados. */
const STUCK_MINUTES = 10;

export default function AdminPage() {
  const { profile, signOut } = useAuth();
  const [error, setError] = React.useState("");

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-[60px] items-center gap-4 px-5 md:px-10">
        <Logo height={18} />
        <span aria-hidden className="h-4 w-px bg-line" />
        <MonoLabel>Administração da plataforma</MonoLabel>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[12.5px] text-ink-muted md:inline">{profile?.email}</span>
          <Button variant="outline" size="sm" asChild>
            <a href="/app">
              Voltar ao app
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </Button>
          <Button variant="quiet" size="sm" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 pb-14 md:px-10">
        <InlineError>{error}</InlineError>

        <Tabs defaultValue="contas">
          <TabsList>
            <TabsTrigger value="contas">Contas</TabsTrigger>
            <TabsTrigger value="visao">Visão geral</TabsTrigger>
            <TabsTrigger value="jobs">Jobs</TabsTrigger>
            <TabsTrigger value="custos">Custos</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
            <TabsTrigger value="sugestoes">Sugestões</TabsTrigger>
            <TabsTrigger value="pesquisa">Pesquisa</TabsTrigger>
          </TabsList>

          <TabsContent value="contas" className="pt-6">
            <ContasTab onError={setError} />
          </TabsContent>
          <TabsContent value="visao" className="pt-6">
            <Overview />
          </TabsContent>
          <TabsContent value="jobs" className="pt-6">
            <Jobs onError={setError} />
          </TabsContent>
          <TabsContent value="custos" className="pt-6">
            <Costs />
          </TabsContent>
          <TabsContent value="auditoria" className="pt-6">
            <AuditLog />
          </TabsContent>
          <TabsContent value="sugestoes" className="pt-6">
            <Feedback onError={setError} />
          </TabsContent>
          <TabsContent value="pesquisa" className="pt-6">
            <Research />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Overview() {
  const query = useQuery({
    queryKey: ["admin-overview"],
    enabled: Boolean(supabase),
    queryFn: async () => {
      const client = supabase!;
      const stuckSince = new Date(Date.now() - STUCK_MINUTES * 60_000).toISOString();
      const [users, workspaces, campaigns, assets, failedJobs, stuckJobs, routines, research] = await Promise.all([
        client.from("profiles").select("id", { count: "exact", head: true }),
        client.from("workspaces").select("id", { count: "exact", head: true }),
        client.from("campaigns").select("id", { count: "exact", head: true }).is("deleted_at", null),
        client.from("creative_assets").select("id", { count: "exact", head: true }).is("deleted_at", null),
        client.from("ai_generation_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
        client
          .from("ai_generation_jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "processing")
          .lt("started_at", stuckSince),
        client.from("routines").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("status", "ativa"),
        client.from("research_responses").select("id", { count: "exact", head: true }),
      ]);

      return {
        users: users.count ?? 0,
        workspaces: workspaces.count ?? 0,
        campaigns: campaigns.count ?? 0,
        assets: assets.count ?? 0,
        failedJobs: failedJobs.count ?? 0,
        stuckJobs: stuckJobs.count ?? 0,
        routines: routines.count ?? 0,
        research: research.count ?? 0,
      };
    },
  });

  if (query.isLoading) return <LoadingBlock label="Carregando indicadores" />;
  if (query.error) return <ErrorState description="Não conseguimos carregar os indicadores." onRetry={() => void query.refetch()} />;

  const data = query.data!;
  const cards = [
    { label: "Usuários", value: data.users },
    { label: "Workspaces", value: data.workspaces },
    { label: "Campanhas", value: data.campaigns },
    { label: "Criativos", value: data.assets },
    { label: "Rotinas ativas", value: data.routines },
    { label: "Jobs com falha", value: data.failedJobs, alert: data.failedJobs > 0 },
    { label: "Jobs travados", value: data.stuckJobs, alert: data.stuckJobs > 0 },
    { label: "Respostas da pesquisa", value: data.research },
  ];

  return (
    <dl className="grid grid-cols-2 gap-x-8 gap-y-6 md:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="flex flex-col gap-1.5">
          <dt className="label-mono">{card.label}</dt>
          <dd className={`text-[26px] font-normal tracking-[-0.02em] ${card.alert ? "text-danger" : "text-ink"}`}>
            {formatInt(card.value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Jobs({ onError }: { onError: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState("todos");
  const [acting, setActing] = React.useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin-jobs", status],
    enabled: Boolean(supabase),
    refetchInterval: 30_000,
    queryFn: async () => {
      let request = supabase!
        .from("ai_generation_jobs")
        .select("*, workspace:workspaces(name)")
        .order("created_at", { ascending: false })
        .limit(80);
      if (status !== "todos") request = request.eq("status", status as "queued");
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  async function act(jobId: string, action: "retry" | "cancel") {
    setActing(jobId);
    try {
      await callFunction("admin-retry-job", { job_id: jobId, action });
      await queryClient.invalidateQueries({ queryKey: ["admin-jobs"] });
      toast.success(action === "retry" ? "Job reaberto para nova tentativa" : "Job cancelado e créditos devolvidos");
    } catch (actError) {
      onError(functionErrorMessage(actError));
    } finally {
      setActing(null);
    }
  }

  if (query.isLoading) return <LoadingBlock label="Carregando jobs" />;
  if (query.error) return <ErrorState description="Falha ao listar jobs." onRetry={() => void query.refetch()} />;

  const stuckSince = Date.now() - STUCK_MINUTES * 60_000;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div className="w-[200px]">
          <Select
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "todos", label: "Todos os status" },
              { value: "queued", label: "Na fila" },
              { value: "processing", label: "Processando" },
              { value: "completed", label: "Concluídos" },
              { value: "failed", label: "Com falha" },
              { value: "cancelled", label: "Cancelados" },
            ]}
            aria-label="Status do job"
          />
        </div>
        <Button variant="quiet" size="sm" onClick={() => void query.refetch()}>
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Atualizar
        </Button>
      </div>

      {!query.data?.length ? (
        <EmptyState title="Nenhum job com esse filtro" />
      ) : (
        <div className="flex flex-col">
          {query.data.map((job) => {
            const isStuck =
              job.status === "processing" && new Date(job.started_at ?? job.created_at).getTime() < stuckSince;
            return (
              <div key={job.id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-line-soft py-3">
                <span className="font-mono text-[11px] text-ink-faint">
                  {new Date(job.created_at).toLocaleString("pt-BR")}
                </span>
                <span className="text-[13px] text-ink">{job.kind}</span>
                <Badge
                  tone={
                    job.status === "failed" ? "danger" : job.status === "completed" ? "positive" : isStuck ? "warning" : "muted"
                  }
                >
                  {isStuck ? "travado" : job.status}
                </Badge>
                <span className="text-[12.5px] text-ink-muted">
                  {(job.workspace as { name?: string } | null)?.name ?? "—"}
                </span>
                <span className="font-mono text-[11.5px] text-ink-2">{formatUSD(Number(job.actual_cost_usd))}</span>
                {job.error && (
                  <span className="w-full truncate text-[12px] text-danger" title={job.error}>
                    {job.error}
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1.5">
                  {(job.status === "failed" || isStuck || job.status === "queued") && (
                    <Button
                      variant="outline"
                      size="sm"
                      loading={acting === job.id}
                      onClick={() => act(job.id, "retry")}
                    >
                      Retentar
                    </Button>
                  )}
                  {job.status !== "completed" && job.status !== "cancelled" && (
                    <Button variant="quiet" size="sm" onClick={() => act(job.id, "cancel")}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Costs() {
  const [days, setDays] = React.useState("30");

  const query = useQuery({
    queryKey: ["admin-costs", days],
    enabled: Boolean(supabase),
    queryFn: async () => {
      const client = supabase!;
      const [byModel, byWorkspace] = await Promise.all([
        client.rpc("admin_cost_by_model", { p_days: Number(days) }),
        client.rpc("admin_cost_by_workspace", { p_days: Number(days) }),
      ]);
      if (byModel.error) throw byModel.error;
      if (byWorkspace.error) throw byWorkspace.error;
      return { byModel: byModel.data ?? [], byWorkspace: byWorkspace.data ?? [] };
    },
  });

  if (query.isLoading) return <LoadingBlock label="Calculando custos" />;
  if (query.error) return <ErrorState description="Falha ao calcular custos." onRetry={() => void query.refetch()} />;

  const total = query.data!.byModel.reduce((sum, row) => sum + Number(row.cost_usd ?? 0), 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <div className="w-[180px]">
          <Select
            value={days}
            onValueChange={setDays}
            options={[
              { value: "7", label: "Últimos 7 dias" },
              { value: "30", label: "Últimos 30 dias" },
              { value: "90", label: "Últimos 90 dias" },
            ]}
            aria-label="Período"
          />
        </div>
        <span className="ml-auto text-[15px] text-ink">
          Total <strong className="font-medium">{formatUSD(total)}</strong>
        </span>
      </div>

      <Panel className="p-5">
        <MonoLabel>Custo por modelo</MonoLabel>
        <div className="mt-3 flex flex-col">
          {query.data!.byModel.map((row) => (
            <div key={row.model} className="flex items-center gap-4 border-b border-line-soft py-2.5 last:border-0">
              <span className="text-[13px] text-ink">{row.model}</span>
              <span className="text-[12px] text-ink-muted">{formatInt(Number(row.events))} chamadas</span>
              <span className="text-[12px] text-ink-muted">{formatInt(Number(row.images))} imagens</span>
              <span className="ml-auto font-mono text-[12.5px] text-ink-2">{formatUSD(Number(row.cost_usd))}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="p-5">
        <MonoLabel>Custo por cliente</MonoLabel>
        <div className="mt-3 flex flex-col">
          {query.data!.byWorkspace.slice(0, 25).map((row) => (
            <div key={row.workspace_id} className="flex items-center gap-4 border-b border-line-soft py-2.5 last:border-0">
              <span className="truncate text-[13px] text-ink">{row.workspace_name}</span>
              <Badge tone="muted">{row.plan}</Badge>
              <span className="text-[12px] text-ink-muted">{formatInt(Number(row.images))} imagens</span>
              <span className="ml-auto font-mono text-[12.5px] text-ink-2">{formatUSD(Number(row.cost_usd))}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function AuditLog() {
  const query = useQuery({
    queryKey: ["admin-audit"],
    enabled: Boolean(supabase),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("audit_logs")
        .select("*, actor:profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(120);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (query.isLoading) return <LoadingBlock label="Carregando auditoria" />;
  if (!query.data?.length) return <EmptyState title="Sem registros" description="As ações relevantes aparecem aqui." />;

  return (
    <div className="flex flex-col">
      {query.data.map((entry) => {
        const actor = entry.actor as { full_name?: string; email?: string } | null;
        return (
          <div key={entry.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line-soft py-2.5">
            <span className="font-mono text-[11px] text-ink-faint">
              {new Date(entry.created_at).toLocaleString("pt-BR")}
            </span>
            <span className="text-[13px] text-ink">{entry.action}</span>
            <span className="text-[12.5px] text-ink-muted">{entry.entity_type}</span>
            <span className="ml-auto text-[12.5px] text-ink-muted">{actor?.email ?? "sistema"}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Portal da pesquisa: continua vivo, agora protegido por role no banco. */
function Research() {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState("todos");
  const [selected, setSelected] = React.useState<ResearchRow | null>(null);

  const labels = React.useMemo(
    () => Object.fromEntries((diagnosisSteps as { key: string; label: string }[]).map((step) => [step.key, step.label])),
    [],
  );

  const responses = useQuery({
    queryKey: ["admin-research"],
    enabled: Boolean(supabase),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("research_responses")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ResearchRow[];
    },
  });

  const filtered = React.useMemo(() => {
    const term = query.trim().toLowerCase();
    return (responses.data ?? []).filter((row) => {
      const matchesSearch =
        !term ||
        [row.nome, row.empresa, row.email, row.telefone].some((value) =>
          String(value ?? "").toLowerCase().includes(term),
        );
      const wantsPilot = row.respostas?.piloto === "Sim, quero participar";
      const matchesFilter = filter === "todos" || (filter === "piloto" ? wantsPilot : !wantsPilot);
      return matchesSearch && matchesFilter;
    });
  }, [responses.data, query, filter]);

  function exportCsv() {
    const keys = (diagnosisSteps as { key: string }[]).map((step) => step.key);
    const escape = (value: unknown) => {
      const text = Array.isArray(value) ? value.join("; ") : String(value ?? "");
      return `"${text.replaceAll('"', '""')}"`;
    };
    const header = ["Data", "Nome", "Empresa", "Telefone", "E-mail", ...keys.map((key) => labels[key] ?? key)];
    const rows = filtered.map((row) => [
      new Date(row.created_at).toLocaleString("pt-BR"),
      row.nome,
      row.empresa,
      row.telefone,
      row.email,
      ...keys.map((key) => row.respostas?.[key]),
    ]);
    const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `creatvos-respostas-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (responses.isLoading) return <LoadingBlock label="Carregando respostas" />;
  if (responses.error)
    return <ErrorState description="Não conseguimos ler as respostas da pesquisa." onRetry={() => void responses.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar nome, empresa ou e-mail"
            className="pl-9"
            aria-label="Buscar respostas"
          />
        </div>
        <div className="w-[220px]">
          <Select
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "todos", label: "Todos os perfis" },
              { value: "piloto", label: "Quer participar do piloto" },
              { value: "outros", label: "Demais respostas" },
            ]}
            aria-label="Filtrar respostas"
          />
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!filtered.length}>
          <Download className="h-3.5 w-3.5" aria-hidden />
          Exportar CSV
        </Button>
      </div>

      <span className="text-[12.5px] text-ink-muted">
        {filtered.length} {filtered.length === 1 ? "resposta" : "respostas"}
      </span>

      {!filtered.length ? (
        <EmptyState title="Nenhuma resposta encontrada" description="Ajuste a busca ou aguarde novas respostas." />
      ) : (
        <div className="flex flex-col">
          {filtered.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelected(row)}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line-soft py-3 text-left transition-colors hover:bg-sunken"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-line-strong text-[11px] text-ink">
                {initials(row.nome)}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-[13.5px] text-ink">{row.nome || "Sem nome"}</span>
                <span className="truncate text-[12px] text-ink-muted">{row.email}</span>
              </div>
              <span className="text-[13px] text-ink-2">{row.empresa}</span>
              {row.respostas?.piloto === "Sim, quero participar" && <Badge tone="accent">Quer testar</Badge>}
              <span className="ml-auto font-mono text-[11px] text-ink-faint">
                {new Date(row.created_at).toLocaleDateString("pt-BR")}
              </span>
            </button>
          ))}
        </div>
      )}

      <Dialog open={Boolean(selected)} onOpenChange={(value) => !value && setSelected(null)}>
        <DialogContent wide title={selected?.nome ?? "Resposta"} description={`${selected?.empresa} · ${selected?.email}`}>
          <div className="flex flex-col">
            {(diagnosisSteps as { key: string; label: string }[]).map((step) => {
              const value = selected?.respostas?.[step.key];
              return (
                <div key={step.key} className="flex flex-col gap-0.5 border-b border-line-soft py-2.5 last:border-0">
                  <span className="label-mono">{step.label}</span>
                  <span className="text-[13.5px] leading-relaxed text-ink">
                    {Array.isArray(value) ? value.join(" · ") : value || "Não informado"}
                  </span>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Divider />
      <p className="text-[12px] text-ink-faint">
        Prompts completos não são exibidos por padrão. Para investigar uma geração, use a aba Jobs.
      </p>
    </div>
  );
}

/** Caixa de sugestões da beta: o que chega pelo botão flutuante do app. */
function Feedback({ onError }: { onError: (message: string) => void }) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = React.useState("aberto");

  const query = useQuery({
    queryKey: ["admin-feedback", filter],
    enabled: Boolean(supabase),
    queryFn: async () => {
      let request = supabase!
        .from("feedback")
        .select("*, autor:profiles(full_name, email)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "todos") request = request.eq("status", filter);
      const { data, error } = await request;
      if (error) throw error;
      return data ?? [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await requireSupabase()
        .from("feedback")
        .update({
          status,
          handled_at: status === "aberto" ? null : new Date().toISOString(),
          handled_by: status === "aberto" ? null : (profile?.id ?? null),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sugestão atualizada");
      void queryClient.invalidateQueries({ queryKey: ["admin-feedback"] });
    },
    onError: () => onError("Não foi possível atualizar a sugestão."),
  });

  if (query.isLoading) return <LoadingBlock label="Carregando sugestões" />;
  if (query.error)
    return <ErrorState description="Não conseguimos ler as sugestões." onRetry={() => void query.refetch()} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={filter}
          onValueChange={setFilter}
          aria-label="Filtrar por situação"
          className="w-[170px]"
          options={[
            { value: "aberto", label: "Abertas" },
            { value: "lido", label: "Lidas" },
            { value: "resolvido", label: "Resolvidas" },
            { value: "todos", label: "Todas" },
          ]}
        />
        <span className="text-[12.5px] text-ink-muted">{formatInt(query.data?.length ?? 0)} recados</span>
        <Button
          variant="quiet"
          size="sm"
          className="ml-auto"
          onClick={() => void query.refetch()}
          aria-label="Recarregar sugestões"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          Recarregar
        </Button>
      </div>

      {!query.data?.length ? (
        <EmptyState title="Nada por aqui" description="Os recados enviados pelo botão de sugestão aparecem nesta aba." />
      ) : (
        <div className="flex flex-col gap-2.5">
          {query.data.map((item) => {
            const autor = item.autor as { full_name?: string; email?: string } | null;
            const tone = item.kind === "problema" ? "danger" : item.kind === "elogio" ? "positive" : "accent";
            return (
              <Panel key={item.id} className="flex flex-col gap-2.5 px-5 py-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  <Badge tone={tone as "accent" | "positive" | "danger"}>{FEEDBACK_KIND[item.kind] ?? item.kind}</Badge>
                  <span className="text-[13px] text-ink">{autor?.full_name || autor?.email || "Anônimo"}</span>
                  {item.path && <span className="font-mono text-[11px] text-ink-faint">{item.path}</span>}
                  <span className="ml-auto font-mono text-[11px] text-ink-faint">
                    {new Date(item.created_at).toLocaleString("pt-BR")}
                  </span>
                </div>

                <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{item.message}</p>

                <div className="flex flex-wrap items-center gap-2">
                  {item.status !== "aberto" && (
                    <Badge tone="muted">{item.status === "lido" ? "Lida" : "Resolvida"}</Badge>
                  )}
                  <div className="ml-auto flex gap-2">
                    {item.status !== "lido" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => update.mutate({ id: item.id, status: "lido" })}
                      >
                        Marcar como lida
                      </Button>
                    )}
                    {item.status !== "resolvido" ? (
                      <Button size="sm" onClick={() => update.mutate({ id: item.id, status: "resolvido" })}>
                        Resolver
                      </Button>
                    ) : (
                      <Button
                        variant="quiet"
                        size="sm"
                        onClick={() => update.mutate({ id: item.id, status: "aberto" })}
                      >
                        Reabrir
                      </Button>
                    )}
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
