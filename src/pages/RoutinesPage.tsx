import * as React from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Copy, Pause, Play, Plus, RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Divider, Dot, Panel } from "@/components/ui/surface";
import { Field, Input, Textarea, MonoLabel, Hint } from "@/components/ui/field";
import { Select, Switch, Checkbox } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/overlays";
import { EmptyState, ErrorState, LoadingBlock, InlineError, Notice } from "@/components/ui/states";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { requireSupabase, supabase } from "@/lib/supabase";
import { callFunction, functionErrorMessage } from "@/lib/functions";
import { routineSchema, type RoutineFormInput, type RoutineInput, CHANNELS, FORMATS, FORMAT_LABEL } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { describeSchedule, formatNextRun } from "@/lib/routines";
import type { Database } from "@/lib/database.types";

type Routine = Database["public"]["Tables"]["routines"]["Row"];
type Run = Database["public"]["Tables"]["routine_runs"]["Row"] & { campaign?: { name: string; status: string } | null };

const WEEKDAYS = [
  { value: "1", label: "Segunda" }, { value: "2", label: "Terça" }, { value: "3", label: "Quarta" },
  { value: "4", label: "Quinta" }, { value: "5", label: "Sexta" }, { value: "6", label: "Sábado" },
  { value: "0", label: "Domingo" },
];

const FREQUENCIES = [
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "data_especifica", label: "Data específica" },
];

function frequencyLabel(routine: Routine): string {
  return describeSchedule({
    frequency: routine.frequency,
    weekday: routine.weekday,
    day_of_month: routine.day_of_month,
    specific_date: routine.specific_date,
    run_at: routine.run_at,
  });
}

export default function RoutinesPage() {
  const { workspaceId, brandId, brands } = useWorkspace();
  const queryClient = useQueryClient();
  const [editing, setEditing] = React.useState<Routine | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [actionError, setActionError] = React.useState("");
  const [runningId, setRunningId] = React.useState<string | null>(null);

  const routines = useQuery({
    queryKey: ["routines", workspaceId, brandId],
    enabled: Boolean(workspaceId && brandId && supabase),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("routines")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .eq("brand_id", brandId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const primary = routines.data?.find((routine) => routine.status === "ativa") ?? routines.data?.[0] ?? null;

  const runs = useQuery({
    queryKey: ["routine-runs", primary?.id],
    enabled: Boolean(primary?.id && supabase),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("routine_runs")
        .select("*, campaign:campaigns(name, status)")
        .eq("routine_id", primary!.id)
        .order("scheduled_for", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as unknown as Run[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const client = requireSupabase();
      const { error } = await client.from("routines").update({ status: active ? "ativa" : "pausada" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["routines"] });
      toast.success("Rotina atualizada");
    },
  });

  const duplicate = useMutation({
    mutationFn: async (routine: Routine) => {
      const client = requireSupabase();
      const { id, created_at, updated_at, next_run_at, last_run_at, ...rest } = routine;
      void id; void created_at; void updated_at; void next_run_at; void last_run_at;
      const { error } = await client.from("routines").insert({ ...rest, name: `${routine.name} (cópia)`, status: "pausada" });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["routines"] });
      toast.success("Rotina duplicada, pausada por segurança");
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const client = requireSupabase();
      const { error } = await client.from("routines").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["routines"] });
      toast.success("Rotina excluída");
    },
  });

  async function runNow(routine: Routine) {
    if (!workspaceId) return;
    setRunningId(routine.id);
    setActionError("");
    try {
      await callFunction("run-routines", { routine_id: routine.id, workspace_id: workspaceId });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["routine-runs"] }),
        queryClient.invalidateQueries({ queryKey: ["routines"] }),
        queryClient.invalidateQueries({ queryKey: ["campaigns"] }),
      ]);
      toast.success("Rotina executada");
    } catch (runError) {
      setActionError(functionErrorMessage(runError));
    } finally {
      setRunningId(null);
    }
  }

  const others = (routines.data ?? []).filter((routine) => routine.id !== primary?.id);

  const columns = React.useMemo(() => {
    const list = runs.data ?? [];
    return [
      { key: "agendado", label: "Agendado", items: list.filter((run) => run.status === "pendente") },
      { key: "gerando", label: "Gerando", items: list.filter((run) => run.status === "executando") },
      {
        key: "revisar",
        label: "Para revisar",
        items: list.filter((run) => run.status === "concluida" && run.campaign?.status === "revisao"),
      },
      {
        key: "aprovado",
        label: "Concluído",
        items: list.filter((run) => run.status === "concluida" && run.campaign?.status !== "revisao"),
      },
    ];
  }, [runs.data]);

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-5 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex max-w-[52ch] flex-col gap-2">
          <h1 className="text-[28px] font-normal tracking-[-0.025em] text-ink md:text-[34px]">Rotinas</h1>
          <p className="text-[14px] leading-relaxed text-ink-muted">
            Escolha canal, formato e produto; a rotina gera os criativos na frequência combinada.
          </p>
        </div>
        <Button variant="outline" className="ml-auto" onClick={() => setCreating(true)} disabled={!brands.length}>
          <Plus className="h-4 w-4" aria-hidden />
          Nova rotina
        </Button>
      </div>

      <InlineError>{actionError}</InlineError>

      {routines.isLoading ? (
        <LoadingBlock label="Carregando rotinas" />
      ) : routines.error ? (
        <ErrorState description="Não conseguimos carregar as rotinas." onRetry={() => void routines.refetch()} />
      ) : !primary ? (
        <EmptyState
          icon={RotateCw}
          title="Nenhuma rotina criada"
          description="Uma rotina prepara briefings no ritmo que você definir. Por segurança, a geração automática começa desligada."
          action={
            <Button size="sm" onClick={() => setCreating(true)}>
              Criar a primeira rotina
            </Button>
          }
        />
      ) : (
        <>
          <Panel className="p-4 md:p-5">
            <div className="flex flex-wrap items-center gap-3">
              <Dot tone={primary.status === "ativa" ? "accent" : "muted"} />
              <h2 className="text-[15.5px] font-medium text-ink">{primary.name}</h2>
              <span className="text-[13px] text-ink-muted">{frequencyLabel(primary)}</span>
              <div className="ml-auto flex items-center gap-2.5">
                <MonoLabel>{primary.status === "ativa" ? "Ativa" : "Pausada"}</MonoLabel>
                <Switch
                  checked={primary.status === "ativa"}
                  onCheckedChange={(value) => toggleActive.mutate({ id: primary.id, active: value })}
                  aria-label={primary.status === "ativa" ? "Pausar rotina" : "Ativar rotina"}
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Chip label="Canal" value={primary.channel} />
              <Chip label="Formato" value={`${primary.quantity} peças · ${primary.formats.join(", ")}`} />
              <Chip label="Geração" value={primary.auto_generate ? "Automática" : "Só o briefing"} />
              <Chip label="Aprovação" value={primary.requires_approval ? "Antes de publicar" : "Direto"} />

              <div className="ml-auto flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(primary)}>
                  Editar
                </Button>
                <Button size="sm" onClick={() => runNow(primary)} loading={runningId === primary.id}>
                  {runningId !== primary.id && <Play className="h-3.5 w-3.5" aria-hidden />}
                  Rodar agora
                </Button>
              </div>
            </div>
          </Panel>

          <div className="flex flex-col gap-3">
            <MonoLabel>Lotes desta rotina</MonoLabel>
            {runs.isLoading ? (
              <LoadingBlock label="Carregando execuções" />
            ) : (runs.data ?? []).length === 0 ? (
              <p className="rounded-[12px] border border-dashed border-line px-4 py-8 text-center text-[13px] text-ink-muted">
                Esta rotina ainda não rodou. Use “Rodar agora” para ver como fica.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {columns.map((column) => (
                  <div key={column.key} className="flex flex-col gap-2.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] text-ink">{column.label}</span>
                      <span className="text-[12px] text-ink-faint">{column.items.length}</span>
                    </div>
                    {column.items.length === 0 ? (
                      <div className="rounded-[12px] border border-dashed border-line px-3 py-6 text-center text-[12px] text-ink-faint">
                        —
                      </div>
                    ) : (
                      column.items.map((run) => (
                        <RunCard key={run.id} run={run} />
                      ))
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {others.length > 0 && (
            <div className="flex flex-col gap-2">
              <MonoLabel>Outras rotinas</MonoLabel>
              {others.map((routine) => (
                <div
                  key={routine.id}
                  className="flex flex-wrap items-center gap-3 border-b border-line-soft py-3"
                >
                  <span className="text-[14px] text-ink">{routine.name}</span>
                  <span className="text-[12.5px] text-ink-muted">{frequencyLabel(routine)}</span>
                  <div className="ml-auto flex items-center gap-1">
                    <Button variant="quiet" size="sm" onClick={() => setEditing(routine)}>
                      Editar
                    </Button>
                    <Button
                      variant="quiet"
                      size="icon"
                      aria-label={routine.status === "ativa" ? "Pausar" : "Ativar"}
                      onClick={() => toggleActive.mutate({ id: routine.id, active: routine.status !== "ativa" })}
                    >
                      {routine.status === "ativa" ? (
                        <Pause className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Play className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </Button>
                    <Button variant="quiet" size="icon" aria-label="Duplicar" onClick={() => duplicate.mutate(routine)}>
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                    <Button variant="quiet" size="icon" aria-label="Excluir" onClick={() => remove.mutate(routine.id)}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Divider className="mt-2" />
      <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-dashed border-line px-4 py-3.5">
        <MonoLabel>Integração com Meta Ads</MonoLabel>
        <Badge tone="muted">Em breve</Badge>
        <p className="text-[12.5px] text-ink-muted">
          Enquanto isso, os resultados são registrados manualmente dentro de cada campanha.
        </p>
      </div>

      <RoutineDialog
        open={creating || Boolean(editing)}
        routine={editing}
        onClose={() => {
          setCreating(false);
          setEditing(null);
        }}
      />
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-[8px] border border-line px-2.5 py-1.5">
      <span className="label-mono">{label}</span>
      <span className="text-[12.5px] text-ink">{value}</span>
    </span>
  );
}

function RunCard({ run }: { run: Run }) {
  const date = new Date(run.scheduled_for).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  const summary = run.summary as { directions?: number; assets?: number };

  const body = (
    <div className="flex flex-col gap-1.5 rounded-[12px] border border-line bg-card px-3.5 py-3">
      <span className="text-[13px] text-ink">Lote de {date}</span>
      <span className="text-[12px] text-ink-muted">
        {run.status === "falhou"
          ? run.error?.slice(0, 60) ?? "Falhou"
          : `${summary?.directions ?? 0} caminhos · ${summary?.assets ?? 0} peças`}
      </span>
      {run.status === "executando" && (
        <div className="h-1 w-full overflow-hidden rounded-full bg-line-soft">
          <div className="h-1 w-1/2 animate-pulse rounded-full bg-accent" />
        </div>
      )}
    </div>
  );

  return run.campaign_id ? (
    <Link to={`/app/campanhas/${run.campaign_id}`} className="transition-opacity hover:opacity-80">
      {body}
    </Link>
  ) : (
    body
  );
}

function RoutineDialog({
  open,
  routine,
  onClose,
}: {
  open: boolean;
  routine: Routine | null;
  onClose: () => void;
}) {
  const { workspaceId, brandId, brands, plan } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = React.useState("");

  const products = useQuery({
    queryKey: ["products", brandId],
    enabled: Boolean(brandId && supabase && open),
    queryFn: async () => {
      const { data } = await supabase!
        .from("products")
        .select("id, name")
        .eq("brand_id", brandId!)
        .is("deleted_at", null);
      return data ?? [];
    },
  });

  const form = useForm<RoutineFormInput, unknown, RoutineInput>({
    resolver: zodResolver(routineSchema),
    defaultValues: {
      name: "",
      brand_id: brandId ?? "",
      product_id: null,
      objective: "",
      frequency: "semanal",
      weekday: 1,
      day_of_month: null,
      specific_date: null,
      run_at: "08:00",
      timezone: "America/Sao_Paulo",
      channel: "Meta Ads",
      formats: ["4:5"],
      quantity: 6,
      recurring_offer: "",
      instructions: "",
      requires_approval: true,
      auto_generate: false,
      allow_image_generation: false,
    },
  });

  React.useEffect(() => {
    if (!open) return;
    if (routine) {
      form.reset({
        name: routine.name,
        brand_id: routine.brand_id,
        product_id: routine.product_id,
        objective: routine.objective,
        frequency: routine.frequency,
        weekday: routine.weekday,
        day_of_month: routine.day_of_month,
        specific_date: routine.specific_date,
        run_at: routine.run_at.slice(0, 5),
        timezone: routine.timezone,
        channel: routine.channel,
        formats: routine.formats as RoutineInput["formats"],
        quantity: routine.quantity,
        recurring_offer: routine.recurring_offer,
        instructions: routine.instructions,
        requires_approval: routine.requires_approval,
        auto_generate: routine.auto_generate,
        allow_image_generation: routine.allow_image_generation,
      });
    } else {
      form.reset({ ...form.getValues(), name: "", brand_id: brandId ?? "" });
    }
  }, [open, routine, brandId, form]);

  const frequency = form.watch("frequency");
  const autoGenerate = form.watch("auto_generate");

  const save = useMutation({
    mutationFn: async (values: RoutineInput) => {
      const client = requireSupabase();
      const payload = {
        ...values,
        workspace_id: workspaceId!,
        created_by: user?.id ?? null,
        // Só uma das três configurações de frequência é usada por vez.
        weekday: values.frequency === "semanal" || values.frequency === "quinzenal" ? values.weekday : null,
        day_of_month: values.frequency === "mensal" ? values.day_of_month : null,
        specific_date: values.frequency === "data_especifica" ? values.specific_date : null,
      };
      const { error: saveError } = routine
        ? await client.from("routines").update(payload).eq("id", routine.id)
        : await client.from("routines").insert(payload);
      if (saveError) throw saveError;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["routines"] });
      toast.success(routine ? "Rotina atualizada" : "Rotina criada");
      onClose();
    },
    onError: () => setError("Não conseguimos salvar a rotina. Confira os campos e tente de novo."),
  });

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent
        wide
        title={routine ? "Editar rotina" : "Nova rotina"}
        description="A rotina prepara o trabalho no ritmo combinado. Você continua no controle do que é gerado."
      >
        <form
          onSubmit={form.handleSubmit((values) => {
            setError("");
            save.mutate(values);
          })}
          className="flex flex-col gap-4"
        >
          <Field label="Nome" htmlFor="routine-name" error={form.formState.errors.name?.message}>
            <Input id="routine-name" {...form.register("name")} placeholder="Promoções da semana" />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {brands.length > 1 && (
              <Field label="Marca" error={form.formState.errors.brand_id?.message}>
                <Controller
                  control={form.control}
                  name="brand_id"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      options={brands.map((brand) => ({ value: brand.id, label: brand.name }))}
                      aria-label="Marca"
                    />
                  )}
                />
              </Field>
            )}

            <Field label="Produto" optional>
              <Controller
                control={form.control}
                name="product_id"
                render={({ field }) => (
                  <Select
                    value={field.value ?? "nenhum"}
                    onValueChange={(value) => field.onChange(value === "nenhum" ? null : value)}
                    options={[
                      { value: "nenhum", label: "Linha principal" },
                      ...(products.data ?? []).map((product) => ({ value: product.id, label: product.name })),
                    ]}
                    aria-label="Produto"
                  />
                )}
              />
            </Field>

            <Field label="Objetivo" optional>
              <Input {...form.register("objective")} placeholder="Vendas, alcance, lembrança…" />
            </Field>

            <Field label="Canal">
              <Controller
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={CHANNELS.map((channel) => ({ value: channel, label: channel }))}
                    aria-label="Canal"
                  />
                )}
              />
            </Field>

            <Field label="Frequência">
              <Controller
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={FREQUENCIES}
                    aria-label="Frequência"
                  />
                )}
              />
            </Field>

            {(frequency === "semanal" || frequency === "quinzenal") && (
              <Field label="Dia da semana" error={form.formState.errors.weekday?.message}>
                <Controller
                  control={form.control}
                  name="weekday"
                  render={({ field }) => (
                    <Select
                      value={field.value !== null && field.value !== undefined ? String(field.value) : undefined}
                      onValueChange={(value) => field.onChange(Number(value))}
                      options={WEEKDAYS}
                      aria-label="Dia da semana"
                    />
                  )}
                />
              </Field>
            )}

            {frequency === "mensal" && (
              <Field label="Dia do mês" error={form.formState.errors.day_of_month?.message} hint="De 1 a 28.">
                <Input type="number" min={1} max={28} {...form.register("day_of_month", { valueAsNumber: true })} />
              </Field>
            )}

            {frequency === "data_especifica" && (
              <Field label="Data" error={form.formState.errors.specific_date?.message}>
                <Input type="date" {...form.register("specific_date")} />
              </Field>
            )}

            <Field label="Horário" error={form.formState.errors.run_at?.message}>
              <Input type="time" {...form.register("run_at")} />
            </Field>

            <Field label="Fuso horário">
              <Controller
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                    options={[
                      { value: "America/Sao_Paulo", label: "Brasília (GMT-3)" },
                      { value: "America/Manaus", label: "Manaus (GMT-4)" },
                      { value: "America/Rio_Branco", label: "Rio Branco (GMT-5)" },
                      { value: "America/Noronha", label: "Fernando de Noronha (GMT-2)" },
                    ]}
                    aria-label="Fuso horário"
                  />
                )}
              />
            </Field>

            <Field label="Quantidade de peças" error={form.formState.errors.quantity?.message}>
              <Input type="number" min={1} max={30} {...form.register("quantity", { valueAsNumber: true })} />
            </Field>
          </div>

          <Field label="Formatos" error={form.formState.errors.formats?.message}>
            <Controller
              control={form.control}
              name="formats"
              render={({ field }) => (
                <div className="flex flex-wrap gap-4">
                  {FORMATS.map((format) => (
                    <label key={format} className="flex cursor-pointer items-center gap-2">
                      <Checkbox
                        checked={(field.value ?? []).includes(format)}
                        onCheckedChange={(checked) =>
                          field.onChange(
                            checked
                              ? [...(field.value ?? []), format]
                              : (field.value ?? []).filter((item) => item !== format),
                          )
                        }
                        aria-label={FORMAT_LABEL[format]}
                      />
                      <span className="text-[13.5px] text-ink">{FORMAT_LABEL[format]}</span>
                    </label>
                  ))}
                </div>
              )}
            />
          </Field>

          <Field label="Oferta recorrente" optional>
            <Input {...form.register("recurring_offer")} placeholder="Frete grátis acima de R$ 120" />
          </Field>

          <Field label="Instruções" optional hint="O que a rotina precisa lembrar toda vez que rodar.">
            <Textarea rows={2} {...form.register("instructions")} />
          </Field>

          <Notice>
            Próxima execução:{" "}
            <strong className="font-medium text-ink">
              {formatNextRun({
                frequency: form.watch("frequency"),
                weekday: form.watch("weekday") ?? null,
                day_of_month: form.watch("day_of_month") ?? null,
                specific_date: form.watch("specific_date") ?? null,
                run_at: form.watch("run_at") ?? "08:00",
              })}
            </strong>
          </Notice>

          <Divider />

          <div className="flex flex-col gap-3">
            <ToggleRow
              control={form.control}
              name="requires_approval"
              label="Exigir aprovação antes de publicar"
              hint="Recomendado. Nada sai da mesa sem você olhar."
            />
            <ToggleRow
              control={form.control}
              name="auto_generate"
              label="Gerar caminhos criativos automaticamente"
              hint="Desligado, a rotina só prepara o briefing em rascunho e avisa você."
            />
            <ToggleRow
              control={form.control}
              name="allow_image_generation"
              label="Autorizar geração de imagens"
              hint={
                autoGenerate
                  ? "Consome créditos do plano a cada execução, e só roda se houver saldo."
                  : "Exige a geração automática ligada."
              }
              disabled={!autoGenerate}
            />
          </div>

          {plan && !plan.auto_routines && autoGenerate && (
            <Notice tone="warning">
              O plano {plan.name} não inclui rotinas automáticas. A rotina vai continuar preparando os briefings,
              mas a geração sozinha exige um plano superior.
            </Notice>
          )}

          <InlineError>{error}</InlineError>

          <DialogFooter>
            <Button type="button" variant="quiet" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={save.isPending}>
              {routine ? "Salvar alterações" : "Criar rotina"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  control,
  name,
  label,
  hint,
  disabled = false,
}: {
  control: ReturnType<typeof useForm<RoutineFormInput, unknown, RoutineInput>>["control"];
  name: "requires_approval" | "auto_generate" | "allow_image_generation";
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <div className={cn("flex items-start gap-3", disabled && "opacity-50")}>
          <div className="pt-0.5">
            <Switch
              checked={Boolean(field.value)}
              onCheckedChange={field.onChange}
              disabled={disabled}
              aria-label={label}
            />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[13.5px] text-ink">{label}</span>
            <Hint>{hint}</Hint>
          </div>
        </div>
      )}
    />
  );
}
