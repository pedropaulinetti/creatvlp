import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { LineChart, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Divider, Panel } from "@/components/ui/surface";
import { Field, Input, Textarea, MonoLabel, Hint } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/overlays";
import { EmptyState, InlineError, Notice } from "@/components/ui/states";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { callFunction, functionErrorMessage } from "@/lib/functions";
import { performanceSchema, type PerformanceFormInput, type PerformanceInput } from "@/lib/schemas";
import { aggregate, confidenceOf, confidenceCaveat, CONFIDENCE_LABEL, derivedMetrics } from "@/lib/metrics";
import { formatBRL, formatInt, formatPercent } from "@/lib/utils";
import type { Database } from "@/lib/database.types";

type Report = Database["public"]["Tables"]["performance_reports"]["Row"];

const today = () => new Date().toISOString().slice(0, 10);
const weekAgo = () => new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);

export function PerformancePanel({
  campaignId,
  brandId,
  reports,
  assets,
}: {
  campaignId: string;
  brandId: string;
  reports: Report[];
  assets: { id: string; composition: unknown }[];
}) {
  const { workspaceId } = useWorkspace();
  const queryClient = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const [error, setError] = React.useState("");
  const [recommending, setRecommending] = React.useState(false);
  const [recommendation, setRecommendation] = React.useState<{
    best_angle: string; best_hook: string; best_format: string; best_offer: string;
    learnings: string[]; next_test: string; caveat: string;
  } | null>(null);

  const totals = aggregate(reports);
  const metrics = derivedMetrics(totals);
  const confidence = confidenceOf(reports);

  const form = useForm<PerformanceFormInput, unknown, PerformanceInput>({
    resolver: zodResolver(performanceSchema),
    defaultValues: {
      campaign_id: campaignId,
      asset_id: null,
      winner_asset_id: null,
      period_start: weekAgo(),
      period_end: today(),
      spend_cents: 0,
      impressions: 0,
      clicks: 0,
      leads: 0,
      purchases: 0,
      revenue_cents: 0,
      notes: "",
    },
  });

  const submit = form.handleSubmit(async (values) => {
    setError("");
    try {
      await callFunction("record-performance", {
        workspace_id: workspaceId,
        campaign_id: campaignId,
        asset_id: values.asset_id,
        winner_asset_id: values.winner_asset_id,
        period_start: values.period_start,
        period_end: values.period_end,
        spend_cents: values.spend_cents,
        impressions: values.impressions,
        clicks: values.clicks,
        leads: values.leads,
        purchases: values.purchases,
        revenue_cents: values.revenue_cents,
        notes: values.notes,
      });
      await queryClient.invalidateQueries({ queryKey: ["campaign"] });
      toast.success("Resultado registrado");
      setOpen(false);
      form.reset({ ...form.getValues(), spend_cents: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0, revenue_cents: 0, notes: "" });
    } catch (submitError) {
      setError(functionErrorMessage(submitError));
    }
  });

  async function recommend() {
    if (!workspaceId) return;
    setRecommending(true);
    setError("");
    try {
      const result = await callFunction<{ recommendation: typeof recommendation; reason: string | null }>(
        "recommend-next-test",
        { workspace_id: workspaceId, brand_id: brandId, campaign_id: campaignId },
      );
      if (!result.recommendation) {
        toast.message(result.reason ?? "Ainda não há dados suficientes.");
      } else {
        setRecommendation(result.recommendation);
      }
      await queryClient.invalidateQueries({ queryKey: ["home-signals"] });
    } catch (recommendError) {
      setError(functionErrorMessage(recommendError));
    } finally {
      setRecommending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <MonoLabel>Resultados registrados manualmente</MonoLabel>
        <div className="ml-auto flex items-center gap-2">
          {reports.length > 0 && (
            <Button variant="outline" size="sm" onClick={recommend} loading={recommending}>
              {!recommending && <Sparkles className="h-3.5 w-3.5" aria-hidden />}
              Recomendar próximo teste
            </Button>
          )}
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Registrar resultado
          </Button>
        </div>
      </div>

      <InlineError>{error}</InlineError>

      {reports.length === 0 ? (
        <EmptyState
          icon={LineChart}
          title="Nenhum resultado registrado"
          description="Depois de rodar os criativos, registre investimento, impressões e vendas para o CreatvOS aprender o que funcionou."
          action={
            <Button size="sm" onClick={() => setOpen(true)}>
              Registrar o primeiro
            </Button>
          }
        />
      ) : (
        <>
          <Panel className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Badge tone={confidence === "consistente" ? "positive" : confidence === "tendencia" ? "accent" : "warning"}>
                {CONFIDENCE_LABEL[confidence]}
              </Badge>
              <span className="text-[12px] text-ink-faint">
                {reports.length} {reports.length === 1 ? "registro" : "registros"}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
              <Metric label="Investimento" value={formatBRL(totals.spend_cents / 100)} />
              <Metric label="Receita" value={formatBRL(totals.revenue_cents / 100)} />
              <Metric label="ROAS" value={metrics.roas ? `${metrics.roas.toFixed(2)}×` : "—"} />
              <Metric label="CTR" value={formatPercent(metrics.ctr)} />
              <Metric label="Impressões" value={formatInt(totals.impressions)} />
              <Metric label="Cliques" value={formatInt(totals.clicks)} />
              <Metric label="CPC" value={metrics.cpc_cents ? formatBRL(metrics.cpc_cents / 100) : "—"} />
              <Metric label="Compras" value={formatInt(totals.purchases)} />
            </dl>

            <Divider className="my-4" />
            <Hint>{confidenceCaveat(confidence)}</Hint>
          </Panel>

          {recommendation && (
            <Panel className="flex flex-col gap-4 p-5">
              <MonoLabel className="text-accent">Leitura do CreatvOS</MonoLabel>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                {[
                  ["Melhor ângulo", recommendation.best_angle],
                  ["Melhor hook", recommendation.best_hook],
                  ["Melhor formato", recommendation.best_format],
                  ["Melhor oferta", recommendation.best_offer],
                ].map(([label, value]) =>
                  value ? (
                    <div key={label} className="flex flex-col gap-0.5">
                      <dt className="label-mono">{label}</dt>
                      <dd className="text-[13.5px] text-ink">{value}</dd>
                    </div>
                  ) : null,
                )}
              </dl>

              {recommendation.learnings.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {recommendation.learnings.map((learning) => (
                    <li key={learning} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
                      <span aria-hidden className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                      {learning}
                    </li>
                  ))}
                </ul>
              )}

              <Notice tone="accent">
                <strong className="font-medium">Próximo teste:</strong> {recommendation.next_test}
              </Notice>
              {recommendation.caveat && <Hint>{recommendation.caveat}</Hint>}
            </Panel>
          )}

          <div className="flex flex-col gap-2">
            {reports.map((report) => {
              const reportMetrics = derivedMetrics(report);
              return (
                <div
                  key={report.id}
                  className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[12px] border border-line bg-card px-4 py-3"
                >
                  <span className="font-mono text-[11.5px] text-ink-muted">
                    {new Date(`${report.period_start}T12:00:00`).toLocaleDateString("pt-BR")} –{" "}
                    {new Date(`${report.period_end}T12:00:00`).toLocaleDateString("pt-BR")}
                  </span>
                  <span className="text-[13px] text-ink">{formatBRL(report.spend_cents / 100)}</span>
                  <span className="text-[13px] text-ink-2">{formatInt(report.impressions)} impressões</span>
                  <span className="text-[13px] text-ink-2">CTR {formatPercent(reportMetrics.ctr)}</span>
                  {reportMetrics.roas !== null && (
                    <span className="text-[13px] text-ink-2">ROAS {reportMetrics.roas.toFixed(2)}×</span>
                  )}
                  {report.notes && (
                    <span className="w-full text-[12.5px] leading-relaxed text-ink-muted">{report.notes}</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          wide
          title="Registrar resultado"
          description="Na beta os números são informados por você. A integração com o Meta Ads chega depois."
        >
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Início do período" htmlFor="period_start" error={form.formState.errors.period_start?.message}>
                <Input id="period_start" type="date" {...form.register("period_start")} />
              </Field>
              <Field label="Fim do período" htmlFor="period_end" error={form.formState.errors.period_end?.message}>
                <Input id="period_end" type="date" {...form.register("period_end")} />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              <Field label="Investimento (R$)" htmlFor="spend">
                <Input
                  id="spend"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={0}
                  onChange={(event) =>
                    form.setValue("spend_cents", Math.round(Number(event.target.value || 0) * 100))
                  }
                />
              </Field>
              <Field label="Impressões" htmlFor="impressions">
                <Input id="impressions" type="number" min={0} {...form.register("impressions", { valueAsNumber: true })} />
              </Field>
              <Field label="Cliques" htmlFor="clicks" error={form.formState.errors.clicks?.message}>
                <Input id="clicks" type="number" min={0} {...form.register("clicks", { valueAsNumber: true })} />
              </Field>
              <Field label="Leads" htmlFor="leads">
                <Input id="leads" type="number" min={0} {...form.register("leads", { valueAsNumber: true })} />
              </Field>
              <Field label="Compras" htmlFor="purchases">
                <Input id="purchases" type="number" min={0} {...form.register("purchases", { valueAsNumber: true })} />
              </Field>
              <Field label="Receita (R$)" htmlFor="revenue">
                <Input
                  id="revenue"
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={0}
                  onChange={(event) =>
                    form.setValue("revenue_cents", Math.round(Number(event.target.value || 0) * 100))
                  }
                />
              </Field>
            </div>

            {assets.length > 0 && (
              <Field label="Criativo vencedor" htmlFor="winner" optional>
                <select
                  id="winner"
                  className="h-10 w-full rounded-[10px] border border-line-strong bg-card px-3 text-[14px] text-ink focus:border-accent focus:outline-none"
                  onChange={(event) => form.setValue("winner_asset_id", event.target.value || null)}
                  defaultValue=""
                >
                  <option value="">Nenhum destacado</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {(asset.composition as { headline?: string })?.headline?.slice(0, 60) || asset.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Observação" htmlFor="notes" optional>
              <Textarea id="notes" rows={2} {...form.register("notes")} placeholder="O que você notou nesse período." />
            </Field>

            <InlineError>{error}</InlineError>

            <DialogFooter>
              <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" loading={form.formState.isSubmitting}>
                Salvar resultado
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="label-mono">{label}</dt>
      <dd className="text-[17px] font-normal tracking-[-0.01em] text-ink">{value}</dd>
    </div>
  );
}
