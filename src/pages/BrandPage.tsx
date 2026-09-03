import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Divider, Panel } from "@/components/ui/surface";
import { Field, Input, Textarea, MonoLabel, Hint } from "@/components/ui/field";
import { TagInput, Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/controls";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { EmptyState, ErrorState, LoadingBlock, InlineError } from "@/components/ui/states";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useAuth } from "@/features/auth/AuthProvider";
import { requireSupabase, supabase } from "@/lib/supabase";
import { signedUrl, uploadBrandFile, validateImageFile } from "@/lib/storage";
import { CHANNELS, FORMATS, FORMAT_LABEL } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/database.types";

type Brand = Database["public"]["Tables"]["brands"]["Row"];
type BrandAsset = Database["public"]["Tables"]["brand_assets"]["Row"];

type Draft = {
  name: string; description: string; website: string; segment: string;
  voice_tone: string; voice_notes: string;
  recommended_words: string[]; forbidden_words: string[]; forbidden_promises: string[];
  differentiators: string[];
  competitors: { name: string; note: string }[];
  proofs: { statement: string; source: string }[];
  recurring_offers: { name: string; detail: string }[];
  colors: { hex: string; role: string; label: string }[];
  typography: { headline: string; body: string };
  channels: string[]; formats: string[]; cadence: string;
};

function toDraft(brand: Brand): Draft {
  const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
  return {
    name: brand.name,
    description: brand.description ?? "",
    website: brand.website ?? "",
    segment: brand.segment ?? "",
    voice_tone: brand.voice_tone ?? "",
    voice_notes: brand.voice_notes ?? "",
    recommended_words: brand.recommended_words ?? [],
    forbidden_words: brand.forbidden_words ?? [],
    forbidden_promises: brand.forbidden_promises ?? [],
    differentiators: brand.differentiators ?? [],
    competitors: asArray(brand.competitors),
    proofs: asArray(brand.proofs),
    recurring_offers: asArray(brand.recurring_offers),
    colors: asArray(brand.colors),
    typography: (brand.typography as { headline: string; body: string }) ?? { headline: "", body: "" },
    channels: brand.channels ?? [],
    formats: brand.formats ?? [],
    cadence: brand.cadence ?? "",
  };
}

function completenessOf(draft: Draft, logoPath: string | null, products: number, audiences: number): number {
  const checks = [
    draft.name.trim().length > 1,
    draft.description.trim().length > 0,
    draft.website.trim().length > 0,
    draft.segment.trim().length > 0,
    Boolean(logoPath),
    draft.colors.length > 0,
    draft.voice_tone.trim().length > 0,
    draft.recommended_words.length > 0,
    draft.forbidden_words.length > 0,
    draft.differentiators.length > 0,
    draft.proofs.length > 0,
    draft.recurring_offers.length > 0,
    products > 0,
    audiences > 0,
    draft.channels.length > 0,
    draft.formats.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function BrandPage() {
  const { brand, workspaceId, refresh } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [error, setError] = React.useState("");
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    if (brand) setDraft(toDraft(brand));
  }, [brand]);

  const products = useQuery({
    queryKey: ["products", brand?.id],
    enabled: Boolean(brand?.id && supabase),
    queryFn: async () => {
      const { data, error: queryError } = await supabase!
        .from("products")
        .select("*")
        .eq("brand_id", brand!.id)
        .is("deleted_at", null)
        .order("created_at");
      if (queryError) throw queryError;
      return data ?? [];
    },
  });

  const audiences = useQuery({
    queryKey: ["audiences", brand?.id],
    enabled: Boolean(brand?.id && supabase),
    queryFn: async () => {
      const { data } = await supabase!.from("audiences").select("*").eq("brand_id", brand!.id).order("created_at");
      return data ?? [];
    },
  });

  const assets = useQuery({
    queryKey: ["brand-assets", brand?.id],
    enabled: Boolean(brand?.id && supabase),
    queryFn: async () => {
      const { data } = await supabase!
        .from("brand_assets")
        .select("*")
        .eq("brand_id", brand!.id)
        .is("deleted_at", null)
        .order("created_at");
      return (data ?? []) as BrandAsset[];
    },
  });

  const logoUrl = useQuery({
    queryKey: ["brand-logo-page", brand?.logo_path],
    enabled: Boolean(brand?.logo_path),
    queryFn: () => signedUrl("brand-assets", brand!.logo_path),
  });

  const versions = useQuery({
    queryKey: ["brand-versions", brand?.id],
    enabled: Boolean(brand?.id && supabase && historyOpen),
    queryFn: async () => {
      const { data } = await supabase!
        .from("brand_versions")
        .select("id, change_summary, created_at")
        .eq("brand_id", brand!.id)
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (values: Draft) => {
      const client = requireSupabase();
      const { error: saveError } = await client
        .from("brands")
        .update({
          name: values.name.trim(),
          description: values.description,
          website: values.website.trim() || null,
          segment: values.segment.trim() || null,
          voice_tone: values.voice_tone,
          voice_notes: values.voice_notes,
          recommended_words: values.recommended_words,
          forbidden_words: values.forbidden_words,
          forbidden_promises: values.forbidden_promises,
          differentiators: values.differentiators,
          competitors: values.competitors,
          proofs: values.proofs,
          recurring_offers: values.recurring_offers,
          colors: values.colors,
          typography: values.typography,
          channels: values.channels,
          formats: values.formats,
          cadence: values.cadence,
          completeness: completenessOf(
            values,
            brand?.logo_path ?? null,
            products.data?.length ?? 0,
            audiences.data?.length ?? 0,
          ),
        })
        .eq("id", brand!.id);
      if (saveError) throw saveError;
    },
    onSuccess: async () => {
      await Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ["brand-versions"] })]);
      toast.success("Memória da marca atualizada");
    },
    onError: () => setError("Não conseguimos salvar. Verifique sua conexão e tente de novo."),
  });

  async function uploadLogo(file: File) {
    if (!workspaceId || !brand) return;
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setError(validation.reason);
      return;
    }
    setUploading(true);
    try {
      const path = await uploadBrandFile({
        bucket: "brand-assets",
        workspaceId,
        brandId: brand.id,
        resourceType: "logo",
        file,
      });
      const client = requireSupabase();
      await client.from("brands").update({ logo_path: path }).eq("id", brand.id);
      await client.from("brand_assets").insert({
        workspace_id: workspaceId,
        brand_id: brand.id,
        kind: "logo",
        storage_path: path,
        bucket: "brand-assets",
        mime_type: file.type,
        size_bytes: file.size,
        created_by: user?.id ?? null,
      });
      await Promise.all([refresh(), assets.refetch(), logoUrl.refetch()]);
      toast.success("Logo atualizada");
    } catch {
      setError("Não conseguimos enviar a logo.");
    } finally {
      setUploading(false);
    }
  }

  if (!brand) {
    return (
      <div className="px-5 py-8 md:px-8">
        <EmptyState title="Nenhuma marca" description="Crie sua marca no onboarding para começar." />
      </div>
    );
  }

  if (!draft) return <LoadingBlock label="Carregando a marca" className="min-h-[60dvh]" />;

  const patch = (values: Partial<Draft>) => setDraft((current) => ({ ...current!, ...values }));
  const score = completenessOf(draft, brand.logo_path, products.data?.length ?? 0, audiences.data?.length ?? 0);

  return (
    <div className="mx-auto flex w-full max-w-[900px] flex-col gap-6 px-5 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex flex-col gap-1.5">
          <MonoLabel className="text-accent">Minha marca</MonoLabel>
          <h1 className="text-[26px] font-normal tracking-[-0.025em] text-ink md:text-[32px]">{brand.name}</h1>
          <Hint>A fonte de verdade de toda geração. O que estiver aqui entra em cada campanha.</Hint>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="quiet" size="sm" onClick={() => setHistoryOpen(true)}>
            <History className="h-3.5 w-3.5" aria-hidden />
            Histórico
          </Button>
          <Button onClick={() => save.mutate(draft)} loading={save.isPending}>
            Salvar
          </Button>
        </div>
      </div>

      {/* Completude: sinal simples, sem gamificação */}
      <div className="flex items-center gap-3">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-line-soft">
          <div
            className={cn("h-1 rounded-full transition-[width]", score > 70 ? "bg-positive" : "bg-accent")}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
          {score}% preenchida
        </span>
      </div>

      <InlineError>{error}</InlineError>

      <Tabs defaultValue="essencial">
        <TabsList>
          <TabsTrigger value="essencial">Essencial</TabsTrigger>
          <TabsTrigger value="voz">Voz e limites</TabsTrigger>
          <TabsTrigger value="mercado">Mercado</TabsTrigger>
          <TabsTrigger value="produtos">Produtos e públicos</TabsTrigger>
          <TabsTrigger value="visual">Visual</TabsTrigger>
        </TabsList>

        <TabsContent value="essencial" className="flex flex-col gap-5 pt-5">
          <Field label="Nome" htmlFor="brand-name">
            <Input id="brand-name" value={draft.name} onChange={(event) => patch({ name: event.target.value })} />
          </Field>
          <Field label="Descrição" htmlFor="brand-description">
            <Textarea
              id="brand-description"
              rows={3}
              value={draft.description}
              onChange={(event) => patch({ description: event.target.value })}
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Site" htmlFor="brand-website" optional>
              <Input id="brand-website" value={draft.website} onChange={(event) => patch({ website: event.target.value })} />
            </Field>
            <Field label="Segmento" htmlFor="brand-segment" optional>
              <Input id="brand-segment" value={draft.segment} onChange={(event) => patch({ segment: event.target.value })} />
            </Field>
          </div>

          <Field label="Canais">
            <div className="flex flex-wrap gap-2">
              {CHANNELS.map((channel) => {
                const selected = draft.channels.includes(channel);
                return (
                  <button
                    key={channel}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      patch({
                        channels: selected
                          ? draft.channels.filter((item) => item !== channel)
                          : [...draft.channels, channel],
                      })
                    }
                    className={cn(
                      "h-8 rounded-full border px-3.5 text-[12.5px] transition-colors",
                      selected ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:border-accent",
                    )}
                  >
                    {channel}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Formatos">
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((format) => {
                const selected = draft.formats.includes(format);
                return (
                  <button
                    key={format}
                    type="button"
                    aria-pressed={selected}
                    onClick={() =>
                      patch({
                        formats: selected ? draft.formats.filter((item) => item !== format) : [...draft.formats, format],
                      })
                    }
                    className={cn(
                      "h-8 rounded-full border px-3.5 text-[12.5px] transition-colors",
                      selected ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:border-accent",
                    )}
                  >
                    {FORMAT_LABEL[format]}
                  </button>
                );
              })}
            </div>
          </Field>
        </TabsContent>

        <TabsContent value="voz" className="flex flex-col gap-5 pt-5">
          <Field label="Tom de voz" htmlFor="voice-tone">
            <Input id="voice-tone" value={draft.voice_tone} onChange={(event) => patch({ voice_tone: event.target.value })} />
          </Field>
          <Field label="Observações sobre a voz" htmlFor="voice-notes" optional>
            <Textarea
              id="voice-notes"
              rows={3}
              value={draft.voice_notes}
              onChange={(event) => patch({ voice_notes: event.target.value })}
              placeholder="Fala em primeira pessoa do plural, evita superlativos…"
            />
          </Field>
          <Field label="Palavras recomendadas" optional>
            <TagInput value={draft.recommended_words} onChange={(value) => patch({ recommended_words: value })} />
          </Field>
          <Field label="Palavras proibidas" optional hint="Nunca aparecem nas copies geradas.">
            <TagInput value={draft.forbidden_words} onChange={(value) => patch({ forbidden_words: value })} tone="danger" />
          </Field>
          <Field
            label="Promessas proibidas"
            optional
            hint="Afirmações que a marca não pode fazer — por regulação, posicionamento ou risco."
          >
            <TagInput
              value={draft.forbidden_promises}
              onChange={(value) => patch({ forbidden_promises: value })}
              tone="danger"
              placeholder="Emagrece sem esforço"
            />
          </Field>
        </TabsContent>

        <TabsContent value="mercado" className="flex flex-col gap-6 pt-5">
          <Field label="Diferenciais" optional>
            <TagInput value={draft.differentiators} onChange={(value) => patch({ differentiators: value })} />
          </Field>

          <PairList
            label="Concorrentes"
            hint="Ajuda a IA a evitar o lugar-comum da categoria."
            items={draft.competitors.map((item) => ({ first: item.name, second: item.note }))}
            firstPlaceholder="Nome"
            secondPlaceholder="O que eles fazem bem"
            onChange={(items) => patch({ competitors: items.map((item) => ({ name: item.first, note: item.second })) })}
          />

          <PairList
            label="Provas e credenciais"
            hint="Só o que estiver aqui pode ser citado como prova nas copies."
            items={draft.proofs.map((item) => ({ first: item.statement, second: item.source }))}
            firstPlaceholder="2 mil clientes recorrentes"
            secondPlaceholder="Fonte"
            onChange={(items) => patch({ proofs: items.map((item) => ({ statement: item.first, source: item.second })) })}
          />

          <PairList
            label="Ofertas recorrentes"
            hint="Promoções que voltam sempre e podem virar rotina."
            items={draft.recurring_offers.map((item) => ({ first: item.name, second: item.detail }))}
            firstPlaceholder="Frete grátis"
            secondPlaceholder="Acima de R$ 120"
            onChange={(items) =>
              patch({ recurring_offers: items.map((item) => ({ name: item.first, detail: item.second })) })
            }
          />
        </TabsContent>

        <TabsContent value="produtos" className="flex flex-col gap-6 pt-5">
          <ProductsSection brandId={brand.id} workspaceId={workspaceId!} products={products} />
          <Divider />
          <AudiencesSection brandId={brand.id} workspaceId={workspaceId!} audiences={audiences} />
        </TabsContent>

        <TabsContent value="visual" className="flex flex-col gap-6 pt-5">
          <div className="flex flex-col gap-2.5">
            <span className="text-[13px] font-medium text-ink">Logo principal</span>
            <div className="flex items-center gap-4">
              <label
                className={cn(
                  "flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-[12px] border border-dashed border-line-contrast bg-card p-2 transition-colors hover:border-accent",
                  brand.logo_path && "border-solid",
                )}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadLogo(file);
                  }}
                />
                {logoUrl.data ? (
                  <img src={logoUrl.data} alt="Logo da marca" className="max-h-full max-w-full object-contain" />
                ) : (
                  <ImagePlus className="h-5 w-5 text-ink-faint" aria-hidden />
                )}
              </label>
              <Hint>{uploading ? "Enviando…" : "PNG ou SVG, até 10 MB. É aplicada nos criativos."}</Hint>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-[13px] font-medium text-ink">Cores</span>
            <div className="flex flex-wrap items-center gap-2">
              {draft.colors.map((color, index) => (
                <span
                  key={`${color.hex}-${index}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1.5 pr-2.5"
                >
                  <span aria-hidden className="h-4 w-4 rounded-full border border-line" style={{ background: color.hex }} />
                  <span className="font-mono text-[11.5px] uppercase text-ink-2">{color.hex}</span>
                  <Badge tone="muted">{color.role}</Badge>
                  <button
                    type="button"
                    aria-label={`Remover ${color.hex}`}
                    onClick={() => patch({ colors: draft.colors.filter((_, position) => position !== index) })}
                    className="text-ink-faint hover:text-danger"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </span>
              ))}
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-line-contrast px-3 py-1.5 text-[12.5px] text-ink-muted hover:border-accent hover:text-ink">
                <input
                  type="color"
                  className="sr-only"
                  onChange={(event) =>
                    patch({
                      colors: [
                        ...draft.colors,
                        {
                          hex: event.target.value.toUpperCase(),
                          role: draft.colors.length === 0 ? "primaria" : "apoio",
                          label: "",
                        },
                      ],
                    })
                  }
                />
                + Cor
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Tipografia de destaque" optional>
              <Input
                value={draft.typography.headline}
                onChange={(event) => patch({ typography: { ...draft.typography, headline: event.target.value } })}
                placeholder="Instrument Serif"
              />
            </Field>
            <Field label="Tipografia de texto" optional>
              <Input
                value={draft.typography.body}
                onChange={(event) => patch({ typography: { ...draft.typography, body: event.target.value } })}
                placeholder="Inter"
              />
            </Field>
          </div>

          <div className="flex flex-col gap-2.5">
            <span className="text-[13px] font-medium text-ink">Referências e exemplos</span>
            {assets.data?.filter((asset) => asset.kind !== "logo").length ? (
              <div className="flex flex-wrap gap-2">
                {assets.data
                  .filter((asset) => asset.kind !== "logo")
                  .map((asset) => (
                    <Badge key={asset.id} tone="muted">
                      {asset.kind.replace("_", " ")}
                    </Badge>
                  ))}
              </div>
            ) : (
              <Hint>Nenhuma referência enviada ainda.</Hint>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent title="Histórico da marca" description="Cada alteração relevante gera uma versão.">
          {versions.isLoading ? (
            <LoadingBlock label="Carregando histórico" />
          ) : !versions.data?.length ? (
            <EmptyState title="Sem alterações registradas" description="As próximas edições aparecem aqui." />
          ) : (
            <div className="flex flex-col">
              {versions.data.map((version) => (
                <div key={version.id} className="flex items-center gap-3 border-b border-line-soft py-2.5 last:border-0">
                  <span className="font-mono text-[11.5px] text-ink-faint">
                    {new Date(version.created_at).toLocaleString("pt-BR")}
                  </span>
                  <span className="text-[13px] text-ink-2">{version.change_summary}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PairList({
  label,
  hint,
  items,
  firstPlaceholder,
  secondPlaceholder,
  onChange,
}: {
  label: string;
  hint?: string;
  items: { first: string; second: string }[];
  firstPlaceholder: string;
  secondPlaceholder: string;
  onChange: (items: { first: string; second: string }[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {hint && <Hint>{hint}</Hint>}
      </div>
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <Input
            value={item.first}
            placeholder={firstPlaceholder}
            aria-label={`${label} ${index + 1}`}
            onChange={(event) => {
              const next = [...items];
              next[index] = { ...item, first: event.target.value };
              onChange(next);
            }}
          />
          <Input
            value={item.second}
            placeholder={secondPlaceholder}
            aria-label={`${label} ${index + 1} detalhe`}
            onChange={(event) => {
              const next = [...items];
              next[index] = { ...item, second: event.target.value };
              onChange(next);
            }}
          />
          <Button
            variant="quiet"
            size="iconLg"
            aria-label={`Remover ${label} ${index + 1}`}
            onClick={() => onChange(items.filter((_, position) => position !== index))}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </Button>
        </div>
      ))}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange([...items, { first: "", second: "" }])}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
        Adicionar
      </Button>
    </div>
  );
}

function ProductsSection({
  brandId,
  workspaceId,
  products,
}: {
  brandId: string;
  workspaceId: string;
  products: ReturnType<typeof useQuery<Database["public"]["Tables"]["products"]["Row"][]>>;
}) {
  const [name, setName] = React.useState("");
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: async (value: string) => {
      const client = requireSupabase();
      const { error } = await client.from("products").insert({
        workspace_id: workspaceId,
        brand_id: brandId,
        name: value.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produto adicionado");
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Database["public"]["Tables"]["products"]["Update"] }) => {
      const client = requireSupabase();
      const { error } = await client.from("products").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const client = requireSupabase();
      const { error } = await client.from("products").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["products"] }),
  });

  if (products.isLoading) return <LoadingBlock label="Carregando produtos" />;
  if (products.error) return <ErrorState description="Não conseguimos carregar os produtos." />;

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-medium text-ink">Produtos e serviços</span>

      {(products.data ?? []).map((product) => (
        <Panel key={product.id} className="flex flex-col gap-2.5 p-4">
          <div className="flex items-center gap-2">
            <Input
              defaultValue={product.name}
              aria-label="Nome do produto"
              onBlur={(event) =>
                event.target.value !== product.name &&
                update.mutate({ id: product.id, values: { name: event.target.value } })
              }
            />
            <Button
              variant="quiet"
              size="iconLg"
              aria-label={`Remover ${product.name}`}
              onClick={() => remove.mutate(product.id)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
          <Textarea
            rows={2}
            defaultValue={product.description}
            aria-label="Descrição do produto"
            placeholder="O que resolve, para quem."
            onBlur={(event) =>
              event.target.value !== product.description &&
              update.mutate({ id: product.id, values: { description: event.target.value } })
            }
          />
        </Panel>
      ))}

      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Novo produto"
          aria-label="Novo produto"
          onKeyDown={(event) => {
            if (event.key === "Enter" && name.trim()) {
              event.preventDefault();
              add.mutate(name);
            }
          }}
        />
        <Button variant="outline" onClick={() => add.mutate(name)} disabled={name.trim().length < 2}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Adicionar
        </Button>
      </div>
    </div>
  );
}

function AudiencesSection({
  brandId,
  workspaceId,
  audiences,
}: {
  brandId: string;
  workspaceId: string;
  audiences: ReturnType<typeof useQuery<Database["public"]["Tables"]["audiences"]["Row"][]>>;
}) {
  const [name, setName] = React.useState("");
  const queryClient = useQueryClient();

  const add = useMutation({
    mutationFn: async (value: string) => {
      const client = requireSupabase();
      const { error } = await client.from("audiences").insert({
        workspace_id: workspaceId,
        brand_id: brandId,
        name: value.trim(),
        is_primary: (audiences.data ?? []).length === 0,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["audiences"] });
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Database["public"]["Tables"]["audiences"]["Update"] }) => {
      const client = requireSupabase();
      const { error } = await client.from("audiences").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audiences"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const client = requireSupabase();
      const { error } = await client.from("audiences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["audiences"] }),
  });

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-medium text-ink">Públicos</span>

      {(audiences.data ?? []).map((audience) => (
        <Panel key={audience.id} className="flex flex-col gap-3 p-4">
          <div className="flex items-center gap-2">
            <Input
              defaultValue={audience.name}
              aria-label="Nome do público"
              onBlur={(event) =>
                event.target.value !== audience.name &&
                update.mutate({ id: audience.id, values: { name: event.target.value } })
              }
            />
            {audience.is_primary && <Badge tone="accent">Principal</Badge>}
            <Button
              variant="quiet"
              size="iconLg"
              aria-label={`Remover ${audience.name}`}
              onClick={() => remove.mutate(audience.id)}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
          <Field label="Dores" optional>
            <TagInput
              value={audience.pains ?? []}
              onChange={(value) => update.mutate({ id: audience.id, values: { pains: value } })}
            />
          </Field>
          <Field label="Desejos" optional>
            <TagInput
              value={audience.desires ?? []}
              onChange={(value) => update.mutate({ id: audience.id, values: { desires: value } })}
            />
          </Field>
          <Field label="Objeções" optional>
            <TagInput
              value={audience.objections ?? []}
              onChange={(value) => update.mutate({ id: audience.id, values: { objections: value } })}
            />
          </Field>
        </Panel>
      ))}

      <div className="flex items-center gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Novo público"
          aria-label="Novo público"
        />
        <Button variant="outline" onClick={() => add.mutate(name)} disabled={name.trim().length < 2}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Adicionar
        </Button>
      </div>
    </div>
  );
}
