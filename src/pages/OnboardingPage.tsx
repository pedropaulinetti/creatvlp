import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Check, Globe, ImagePlus, Loader2, ShoppingBag, Sparkles, Trash2, Type, X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, Hint, MonoLabel } from "@/components/ui/field";
import { TagInput, Checkbox } from "@/components/ui/controls";
import { InlineError, Notice } from "@/components/ui/states";
import { useAuth } from "@/features/auth/AuthProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { requireSupabase } from "@/lib/supabase";
import { callFunction, functionErrorMessage } from "@/lib/functions";
import { uploadBrandFile, validateImageFile } from "@/lib/storage";
import { CHANNELS, FORMATS, FORMAT_LABEL } from "@/lib/schemas";
import { normalizeUrl, looksLikeUrl, prettyUrl } from "@/lib/url";
import { cn, greeting } from "@/lib/utils";

type Draft = {
  brandId: string;
  company: string;
  website: string;
  segment: string;
  description: string;
  colors: { hex: string; role: string; label: string }[];
  logoPath: string | null;
  referencePaths: string[];
  products: { name: string; description: string }[];
  audience: string;
  audiencePains: string[];
  voiceTone: string;
  recommendedWords: string[];
  forbiddenWords: string[];
  channels: string[];
  formats: string[];
  cadence: string;
  typography: { headline: string; body: string };
};

type Detectado = {
  colors: { hex: string; role: string; label: string }[];
  fonts: { headline: string; body: string; candidates: string[] };
  logoPath: string | null;
  stylesheets: number;
  shopify: {
    vendor: string;
    currency: string;
    products: { name: string; description: string; price_cents: number | null; image: string | null; highlights: string[] }[];
    product_types: string[];
  } | null;
  confidence: string;
  textoOk: boolean;
};

const CADENCES = ["Semanal", "Quinzenal", "Mensal", "Por campanha"];
const TONES = [
  "Direto e objetivo", "Próximo e caloroso", "Técnico e preciso",
  "Editorial e sofisticado", "Divertido e leve", "Confiante e assertivo",
];

const emptyDraft = (): Draft => ({
  brandId: crypto.randomUUID(),
  company: "", website: "", segment: "", description: "",
  colors: [], logoPath: null, referencePaths: [],
  products: [], audience: "", audiencePains: [], voiceTone: "",
  recommendedWords: [], forbiddenWords: [], channels: [], formats: ["4:5"], cadence: "Semanal",
  typography: { headline: "", body: "" },
});

const STORAGE_KEY = "creatvos:onboarding";

const STEPS = [
  { key: "empresa", label: "Empresa", title: "Qual é a marca?", required: true },
  { key: "identidade", label: "Identidade", title: "Como ela se apresenta?", required: false },
  { key: "produtos", label: "Produtos", title: "O que ela vende?", required: true },
  { key: "publico", label: "Público", title: "Para quem ela vende?", required: false },
  { key: "voz", label: "Tom de voz", title: "Como ela fala?", required: false },
  { key: "canais", label: "Canais", title: "Onde ela aparece?", required: false },
  { key: "frequencia", label: "Frequência", title: "Com que ritmo?", required: false },
  { key: "revisao", label: "Revisão", title: "Confira a memória da marca", required: true },
] as const;

export default function OnboardingPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { workspaceId, refresh } = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  /**
   * O caminho normal começa pelo site: ele preenche quase tudo e a pessoa só
   * revisa. Quem não tem site (ou cujo site não deu leitura) segue etapa a etapa.
   */
  const [fase, setFase] = React.useState<"site" | "revisao" | "etapas">("site");
  const [step, setStep] = React.useState(0);
  const [draft, setDraft] = React.useState<Draft>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return { ...emptyDraft(), ...(JSON.parse(stored) as Draft) };
      } catch {
        /* rascunho corrompido: começa do zero */
      }
    }
    return emptyDraft();
  });
  const [resumed] = React.useState(() => Boolean(localStorage.getItem(STORAGE_KEY)));
  const [analyzing, setAnalyzing] = React.useState(false);
  const [detectado, setDetectado] = React.useState<Detectado | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState("");
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  }, [draft]);

  // Quem já tinha começado não volta para a tela do site.
  React.useEffect(() => {
    if (resumed && draft.company.trim()) setFase("revisao");
    // Só na montagem: depois disso quem manda é a navegação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = (values: Partial<Draft>) => setDraft((current) => ({ ...current, ...values }));

  const current = STEPS[step];
  const canAdvance = (() => {
    if (current.key === "empresa") return draft.company.trim().length >= 2;
    if (current.key === "produtos") return draft.products.some((product) => product.name.trim());
    return true;
  })();

  async function analyzeWebsite(enderecoDireto?: string) {
    if (!workspaceId) return;
    const url = (enderecoDireto ?? draft.website).trim();
    if (!url) {
      setError("Informe o endereço do site para analisarmos.");
      return;
    }
    const endereco = normalizeUrl(url);
    if (!looksLikeUrl(endereco)) {
      setError("Endereço incompleto. Escreva o domínio inteiro, como suamarca.com.br");
      return;
    }

    setAnalyzing(true);
    setError("");
    try {
      const result = await callFunction<{
        analysis: {
          name: string; description: string; segment: string; voice_tone: string;
          colors: { hex: string; role: string; label: string }[];
          products: { name: string; description: string }[];
          audience: string; differentiators: string[]; confidence: string;
        };
        design_system: {
          colors: { hex: string; role: string; label: string }[];
          fonts: { headline: string; body: string; candidates: string[] };
          stylesheets: number;
          logo_path: string | null;
        } | null;
        shopify: Detectado["shopify"];
        text_analysis?: { ok: boolean; reason: string };
      }>("analyze-brand", { workspace_id: workspaceId, url: endereco, brand_id: draft.brandId });

      const { analysis, design_system: ds, shopify } = result;

      setDetectado({
        colors: ds?.colors ?? [],
        fonts: ds?.fonts ?? { headline: "", body: "", candidates: [] },
        logoPath: ds?.logo_path ?? null,
        stylesheets: ds?.stylesheets ?? 0,
        shopify,
        confidence: analysis.confidence,
        textoOk: result.text_analysis?.ok ?? true,
      });

      patch({
        website: endereco,
        company: draft.company || analysis.name || shopify?.vendor || "",
        description: draft.description || analysis.description,
        segment: draft.segment || analysis.segment || shopify?.product_types?.[0] || "",
        voiceTone: draft.voiceTone || analysis.voice_tone,
        colors: draft.colors.length ? draft.colors : (ds?.colors ?? analysis.colors),
        typography: ds?.fonts && (ds.fonts.headline || ds.fonts.body)
          ? { headline: ds.fonts.headline, body: ds.fonts.body }
          : draft.typography,
        logoPath: draft.logoPath ?? ds?.logo_path ?? null,
        products: draft.products.length
          ? draft.products
          : (shopify?.products.map((item) => ({ name: item.name, description: item.description })) ??
             analysis.products),
      });

      const rendeu =
        (ds?.colors.length ?? 0) > 0 ||
        Boolean(ds?.fonts.headline || ds?.fonts.body) ||
        (shopify?.products.length ?? 0) > 0;

      if (rendeu) {
        setFase("revisao");
        toast.success(
          shopify?.products.length
            ? `Loja Shopify lida: ${shopify.products.length} produtos importados.`
            : "Lemos seu site. Confira o que encontramos.",
        );
      } else {
        // Sem nada aproveitável, insistir na leitura só faz perder tempo.
        setFase("etapas");
        toast.message("A leitura trouxe pouca coisa. Vamos preencher juntos.");
      }
    } catch (analyzeError) {
      setError(functionErrorMessage(analyzeError));
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleUpload(file: File, kind: "logo" | "referencia") {
    if (!workspaceId) return;
    const validation = validateImageFile(file);
    if (!validation.ok) {
      setError(validation.reason);
      return;
    }
    setUploading(true);
    setError("");
    try {
      const path = await uploadBrandFile({
        bucket: "brand-assets",
        workspaceId,
        brandId: draft.brandId,
        resourceType: kind,
        file,
      });
      if (kind === "logo") patch({ logoPath: path });
      else patch({ referencePaths: [...draft.referencePaths, path] });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Não foi possível enviar o arquivo.");
    } finally {
      setUploading(false);
    }
  }

  async function finish() {
    if (!workspaceId || !user) return;
    setSaving(true);
    setError("");
    const client = requireSupabase();

    try {
      const { error: brandError } = await client.from("brands").insert({
        id: draft.brandId,
        workspace_id: workspaceId,
        name: draft.company.trim(),
        description: draft.description.trim(),
        website: draft.website.trim() || null,
        segment: draft.segment.trim() || null,
        voice_tone: draft.voiceTone,
        recommended_words: draft.recommendedWords,
        forbidden_words: draft.forbiddenWords,
        colors: draft.colors,
        typography: draft.typography,
        channels: draft.channels,
        formats: draft.formats,
        cadence: draft.cadence,
        logo_path: draft.logoPath,
        completeness: completeness(draft),
        created_by: user.id,
      });
      if (brandError) throw brandError;

      const products = draft.products.filter((product) => product.name.trim());
      if (products.length) {
        const { error: productsError } = await client.from("products").insert(
          products.map((product) => ({
            workspace_id: workspaceId,
            brand_id: draft.brandId,
            name: product.name.trim(),
            description: product.description.trim(),
            created_by: user.id,
          })),
        );
        if (productsError) throw productsError;
      }

      if (draft.audience.trim()) {
        await client.from("audiences").insert({
          workspace_id: workspaceId,
          brand_id: draft.brandId,
          name: draft.audience.trim().slice(0, 80),
          description: draft.audience.trim(),
          pains: draft.audiencePains,
          is_primary: true,
          created_by: user.id,
        });
      }

      const assets = [
        ...(draft.logoPath ? [{ kind: "logo", path: draft.logoPath }] : []),
        ...draft.referencePaths.map((path) => ({ kind: "referencia", path })),
      ];
      if (assets.length) {
        await client.from("brand_assets").insert(
          assets.map((asset) => ({
            workspace_id: workspaceId,
            brand_id: draft.brandId,
            kind: asset.kind,
            storage_path: asset.path,
            bucket: "brand-assets",
            mime_type: asset.path.endsWith(".svg") ? "image/svg+xml" : "image/png",
            size_bytes: 0,
            created_by: user.id,
          })),
        );
      }

      const { error: profileError } = await client
        .from("profiles")
        .update({ onboarding_completed_at: new Date().toISOString() })
        .eq("id", user.id);
      if (profileError) throw profileError;

      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem("creatvos:brand", draft.brandId);
      await Promise.all([refreshProfile(), refresh(), queryClient.invalidateQueries()]);
      toast.success("Marca criada. Bem-vindo ao CreatvOS.");
      navigate("/app", { replace: true });
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "";
      setError(
        message.includes("duplicate") || message.includes("unique")
          ? "Já existe uma marca com esses dados. Recarregue a página e tente de novo."
          : "Não conseguimos salvar sua marca. Verifique sua conexão e tente novamente.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="flex h-[60px] shrink-0 items-center gap-4 px-5 md:px-10">
        <Logo height={18} />
        <span aria-hidden className="hidden h-4 w-px bg-line md:block" />
        <MonoLabel className="hidden md:inline">Configuração inicial</MonoLabel>
        {fase === "etapas" && (
          <span className="ml-auto font-mono text-[11px] uppercase tracking-[0.12em] text-ink-faint">
            {String(step + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
          </span>
        )}
      </header>

      {/* ------------------------------------------------- 1. o site */}
      {fase === "site" && (
        <main className="flex flex-1 items-center justify-center px-5 py-10 md:px-10">
          <div className="flex w-full max-w-[560px] flex-col gap-7">
            <div className="flex flex-col gap-3">
              <MonoLabel className="text-accent">
                {greeting()}
                {profile?.full_name?.trim() ? `, ${profile.full_name.trim().split(" ")[0]}` : ""}
              </MonoLabel>
              <h1 className="text-[32px] font-normal leading-[1.08] tracking-[-0.03em] text-ink md:text-[42px]">
                Vamos começar pelo seu site.
              </h1>
              <p className="text-[15px] leading-relaxed text-ink-muted">
                Cole o endereço e a gente monta a memória da marca: paleta, tipografia,
                logo e — se for loja — o catálogo inteiro. Você só confere.
              </p>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void analyzeWebsite();
              }}
              className="flex flex-col gap-3"
            >
              <Field label="Endereço do site" htmlFor="website">
                <div className="flex gap-2">
                  <Input
                    id="website"
                    autoFocus
                    value={draft.website}
                    onChange={(event) => patch({ website: event.target.value })}
                    onPaste={(event) => {
                      // Colar o endereço já dispara a leitura: é o gesto natural.
                      const colado = event.clipboardData.getData("text");
                      if (looksLikeUrl(colado)) {
                        event.preventDefault();
                        patch({ website: normalizeUrl(colado) });
                        window.setTimeout(() => void analyzeWebsite(normalizeUrl(colado)), 0);
                      }
                    }}
                    onBlur={() => draft.website.trim() && patch({ website: normalizeUrl(draft.website) })}
                    placeholder="suamarca.com.br"
                    inputMode="url"
                    autoComplete="url"
                    spellCheck={false}
                    className="h-11 text-[15px]"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    loading={analyzing}
                    disabled={!looksLikeUrl(draft.website)}
                    className="shrink-0"
                  >
                    {!analyzing && <Globe className="h-4 w-4" aria-hidden />}
                    {analyzing ? "Lendo" : "Analisar"}
                  </Button>
                </div>
              </Field>

              <InlineError>{error}</InlineError>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1" aria-live="polite">
                <span className="label-mono">{analyzing ? "Lendo" : "Lemos do site"}</span>
                {["Paleta", "Tipografia", "Logo", "Produtos"].map((item) => (
                  <span
                    key={item}
                    className={cn(
                      "flex items-center gap-1.5 text-[12.5px] transition-colors",
                      analyzing ? "text-ink-faint" : "text-ink-muted",
                    )}
                  >
                    {analyzing ? (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    ) : (
                      <Check className="h-3 w-3 text-positive" aria-hidden />
                    )}
                    {item}
                  </span>
                ))}
              </div>
              {analyzing && draft.website && (
                <Hint>
                  Lendo {prettyUrl(draft.website)} — folhas de estilo e catálogo. Leva alguns segundos.
                </Hint>
              )}
            </form>

            <div className="flex items-center gap-3 border-t border-line-soft pt-5">
              <Button variant="ghost" onClick={() => setFase("etapas")} className="px-0">
                Não tenho site — preencher manualmente
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        </main>
      )}

      {/* --------------------------------------------- 2. revisão do que veio */}
      {fase === "revisao" && (
        <main className="flex flex-1 justify-center px-5 py-8 md:px-10 md:py-10">
          <div className="flex w-full max-w-[680px] flex-col gap-6">
            <div className="flex flex-col gap-2.5">
              <MonoLabel className="text-accent">Revisão</MonoLabel>
              <h1 className="text-[30px] font-normal leading-[1.1] tracking-[-0.03em] text-ink md:text-[38px]">
                É isso mesmo?
              </h1>
              <Hint>
                Tudo aqui é editável e nada foi gravado ainda. O que faltar você completa depois
                em Minha Marca.
              </Hint>
            </div>

            {detectado && <PainelDetectado dados={detectado} />}

            <div className="flex flex-col gap-5 rounded-[14px] border border-line-strong bg-card p-5">
              <Field label="Nome da marca" htmlFor="rev-company">
                <Input
                  id="rev-company"
                  value={draft.company}
                  onChange={(event) => patch({ company: event.target.value })}
                  placeholder="Minas Estate Coffee"
                />
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Segmento" htmlFor="rev-segment" optional>
                  <Input
                    id="rev-segment"
                    value={draft.segment}
                    onChange={(event) => patch({ segment: event.target.value })}
                  />
                </Field>
                <Field label="Tom de voz" htmlFor="rev-tone" optional>
                  <Input
                    id="rev-tone"
                    value={draft.voiceTone}
                    onChange={(event) => patch({ voiceTone: event.target.value })}
                    placeholder="Próximo e informativo"
                  />
                </Field>
              </div>

              <Field label="O que a marca faz" htmlFor="rev-description" optional>
                <Textarea
                  id="rev-description"
                  rows={2}
                  value={draft.description}
                  onChange={(event) => patch({ description: event.target.value })}
                />
              </Field>

              <Field
                label={`Produtos${draft.products.length ? ` · ${draft.products.length}` : ""}`}
                hint={
                  detectado?.shopify
                    ? "Importados da sua loja. Desmarque o que não quiser."
                    : "Adicione ao menos um produto ou serviço."
                }
              >
                <div className="flex flex-col gap-1.5">
                  {draft.products.map((produto, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={produto.name}
                        aria-label={`Produto ${index + 1}`}
                        onChange={(event) => {
                          const next = [...draft.products];
                          next[index] = { ...produto, name: event.target.value };
                          patch({ products: next });
                        }}
                      />
                      <Button
                        type="button"
                        variant="quiet"
                        size="iconLg"
                        aria-label={`Remover ${produto.name || `produto ${index + 1}`}`}
                        onClick={() =>
                          patch({ products: draft.products.filter((_, i) => i !== index) })
                        }
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => patch({ products: [...draft.products, { name: "", description: "" }] })}
                  >
                    + Adicionar produto
                  </Button>
                </div>
              </Field>

              <Field label="Quem compra de você" htmlFor="rev-audience" optional>
                <Textarea
                  id="rev-audience"
                  rows={2}
                  value={draft.audience}
                  onChange={(event) => patch({ audience: event.target.value })}
                  placeholder="Quem é a pessoa, o que ela busca e o que a faz comprar."
                />
              </Field>
            </div>

            <InlineError>{error}</InlineError>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="quiet" onClick={() => setFase("etapas")}>
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
                Revisar etapa por etapa
              </Button>
              <Button
                className="ml-auto"
                onClick={finish}
                loading={saving}
                disabled={draft.company.trim().length < 2 || !draft.products.some((p) => p.name.trim())}
              >
                {!saving && <Sparkles className="h-4 w-4" aria-hidden />}
                Criar minha marca
              </Button>
            </div>
          </div>
        </main>
      )}

      {/* ------------------------------------------- 3. etapa a etapa */}
      {fase === "etapas" && (
        <>
      {/* Trilha de etapas */}
      <div className="px-5 md:px-10">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {STEPS.map((item, index) => (
            <li key={item.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => index <= step && setStep(index)}
                disabled={index > step}
                aria-current={index === step ? "step" : undefined}
                className={cn(
                  "font-mono text-[10.5px] uppercase tracking-[0.12em] transition-colors",
                  index === step ? "text-accent" : index < step ? "text-ink-2 hover:text-ink" : "text-ink-faint",
                  index > step && "cursor-default",
                )}
              >
                {item.label}
              </button>
              {index < STEPS.length - 1 && <span aria-hidden className="h-px w-4 bg-line-contrast" />}
            </li>
          ))}
        </ol>
        <div className="mt-3 h-px w-full bg-line" role="presentation">
          <div
            className="h-px bg-accent transition-[width] duration-300"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <main className="flex flex-1 justify-center px-5 py-8 md:px-10 md:py-12">
        <div className="flex w-full max-w-[620px] flex-col gap-7">
          <div className="flex flex-col gap-2.5">
            <MonoLabel className="text-accent">
              {greeting()}
              {profile?.full_name?.trim() ? `, ${profile.full_name.trim().split(" ")[0]}` : ""}
            </MonoLabel>
            <h1 className="text-[30px] font-normal leading-[1.1] tracking-[-0.03em] text-ink md:text-[38px]">
              {current.title}
            </h1>
            {!current.required && (
              <Hint>Pode pular o que não souber agora — dá para completar depois em Minha Marca.</Hint>
            )}
          </div>

          {resumed && step === 0 && (
            <Notice tone="accent">
              Retomamos o que você já tinha preenchido. Ajuste o que quiser e siga daqui.
            </Notice>
          )}

          {/* ---------------------------------------------------------- etapas */}
          {current.key === "empresa" && (
            <div className="flex flex-col gap-5">
              <Field label="Nome da empresa" htmlFor="company">
                <Input
                  id="company"
                  autoFocus
                  value={draft.company}
                  onChange={(event) => patch({ company: event.target.value })}
                  placeholder="Minas Estate Coffee"
                />
              </Field>

              <Field
                label="Site"
                htmlFor="website-manual"
                optional
                hint="Se informar, tentamos ler a página e preencher o que der."
              >
                <div className="flex gap-2">
                  <Input
                    id="website-manual"
                    value={draft.website}
                    onChange={(event) => patch({ website: event.target.value })}
                    placeholder="https://suamarca.com.br"
                    inputMode="url"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void analyzeWebsite()}
                    loading={analyzing}
                    disabled={!draft.website.trim()}
                    className="shrink-0"
                  >
                    {!analyzing && <Globe className="h-3.5 w-3.5" aria-hidden />}
                    Analisar
                  </Button>
                </div>
              </Field>

              {detectado && <PainelDetectado dados={detectado} />}

              <Field label="Segmento" htmlFor="segment" optional>
                <Input
                  id="segment"
                  value={draft.segment}
                  onChange={(event) => patch({ segment: event.target.value })}
                  placeholder="Café especial, ecommerce, SaaS..."
                />
              </Field>

              <Field label="Em uma frase, o que a marca faz?" htmlFor="description" optional>
                <Textarea
                  id="description"
                  rows={3}
                  value={draft.description}
                  onChange={(event) => patch({ description: event.target.value })}
                  placeholder="Torrefação de cafés especiais de Minas, com assinatura mensal."
                />
              </Field>
            </div>
          )}

          {current.key === "identidade" && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-ink">Logo</span>
                <div className="flex items-center gap-3">
                  <label
                    className={cn(
                      "flex h-20 w-20 cursor-pointer items-center justify-center rounded-[12px] border border-dashed border-line-contrast bg-card transition-colors hover:border-accent",
                      draft.logoPath && "border-solid border-positive",
                    )}
                  >
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml,image/webp"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleUpload(file, "logo");
                      }}
                    />
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-ink-faint" aria-hidden />
                    ) : draft.logoPath ? (
                      <Check className="h-5 w-5 text-positive" aria-hidden />
                    ) : (
                      <ImagePlus className="h-5 w-5 text-ink-faint" aria-hidden />
                    )}
                  </label>
                  <Hint>
                    {draft.logoPath ? "Logo enviada. Clique para trocar." : "PNG ou SVG, até 10 MB."}
                  </Hint>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-[13px] font-medium text-ink">Cores da marca</span>
                <div className="flex flex-wrap items-center gap-2">
                  {draft.colors.map((color, index) => (
                    <span
                      key={`${color.hex}-${index}`}
                      className="inline-flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1.5 pr-2.5"
                    >
                      <span
                        aria-hidden
                        className="h-4 w-4 rounded-full border border-line"
                        style={{ background: color.hex }}
                      />
                      <span className="font-mono text-[11.5px] uppercase text-ink-2">{color.hex}</span>
                      <button
                        type="button"
                        aria-label={`Remover cor ${color.hex}`}
                        onClick={() => patch({ colors: draft.colors.filter((_, position) => position !== index) })}
                        className="text-ink-faint hover:text-danger"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-dashed border-line-contrast px-3 py-1.5 text-[12.5px] text-ink-muted transition-colors hover:border-accent hover:text-ink">
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
                <Hint>A primeira cor vira a cor primária, usada nos criativos.</Hint>
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-[13px] font-medium text-ink">Referências visuais</span>
                <div className="flex flex-wrap gap-2">
                  {draft.referencePaths.map((path, index) => (
                    <span
                      key={path}
                      className="inline-flex items-center gap-2 rounded-[8px] border border-line bg-card px-2.5 py-1.5 text-[12px] text-ink-2"
                    >
                      Referência {index + 1}
                      <button
                        type="button"
                        aria-label={`Remover referência ${index + 1}`}
                        onClick={() =>
                          patch({ referencePaths: draft.referencePaths.filter((item) => item !== path) })
                        }
                        className="text-ink-faint hover:text-danger"
                      >
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-[8px] border border-dashed border-line-contrast px-3 py-1.5 text-[12.5px] text-ink-muted transition-colors hover:border-accent hover:text-ink">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleUpload(file, "referencia");
                      }}
                    />
                    <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                    Adicionar
                  </label>
                </div>
              </div>
            </div>
          )}

          {current.key === "produtos" && (
            <div className="flex flex-col gap-4">
              {draft.products.map((product, index) => (
                <div key={index} className="flex flex-col gap-2.5 rounded-[12px] border border-line bg-card p-4">
                  <div className="flex items-center gap-2">
                    <Input
                      value={product.name}
                      onChange={(event) => {
                        const next = [...draft.products];
                        next[index] = { ...product, name: event.target.value };
                        patch({ products: next });
                      }}
                      placeholder="Nome do produto ou serviço"
                    />
                    <Button
                      type="button"
                      variant="quiet"
                      size="iconLg"
                      aria-label={`Remover ${product.name || "produto"}`}
                      onClick={() => patch({ products: draft.products.filter((_, position) => position !== index) })}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    value={product.description}
                    onChange={(event) => {
                      const next = [...draft.products];
                      next[index] = { ...product, description: event.target.value };
                      patch({ products: next });
                    }}
                    placeholder="O que ele resolve, para quem, em uma ou duas frases."
                  />
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                onClick={() => patch({ products: [...draft.products, { name: "", description: "" }] })}
                className="self-start"
              >
                + Adicionar produto
              </Button>
            </div>
          )}

          {current.key === "publico" && (
            <div className="flex flex-col gap-5">
              <Field label="Quem compra de você?" htmlFor="audience">
                <Textarea
                  id="audience"
                  rows={3}
                  autoFocus
                  value={draft.audience}
                  onChange={(event) => patch({ audience: event.target.value })}
                  placeholder="Pessoas de 30 a 50 anos que fazem café em casa e valorizam origem."
                />
              </Field>
              <Field label="Principais dores desse público" optional hint="Uma por vez, pressionando Enter.">
                <TagInput
                  value={draft.audiencePains}
                  onChange={(value) => patch({ audiencePains: value })}
                  placeholder="Não sabe qual café escolher"
                />
              </Field>
            </div>
          )}

          {current.key === "voz" && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2.5">
                <span className="text-[13px] font-medium text-ink">Tom de voz</span>
                <div className="flex flex-wrap gap-2">
                  {TONES.map((tone) => (
                    <button
                      key={tone}
                      type="button"
                      onClick={() => patch({ voiceTone: draft.voiceTone === tone ? "" : tone })}
                      aria-pressed={draft.voiceTone === tone}
                      className={cn(
                        "h-8 rounded-full border px-3.5 text-[12.5px] transition-colors",
                        draft.voiceTone === tone
                          ? "border-accent bg-accent-soft text-accent-ink"
                          : "border-line text-ink-2 hover:border-accent hover:text-ink",
                      )}
                    >
                      {tone}
                    </button>
                  ))}
                </div>
                <Input
                  value={TONES.includes(draft.voiceTone) ? "" : draft.voiceTone}
                  onChange={(event) => patch({ voiceTone: event.target.value })}
                  placeholder="Ou descreva com suas palavras"
                />
              </div>

              <Field label="Palavras que combinam com a marca" optional>
                <TagInput
                  value={draft.recommendedWords}
                  onChange={(value) => patch({ recommendedWords: value })}
                  placeholder="origem, torra, frescor"
                />
              </Field>

              <Field
                label="Palavras proibidas"
                optional
                hint="A IA nunca vai usar nenhuma delas nas copies."
              >
                <TagInput
                  value={draft.forbiddenWords}
                  onChange={(value) => patch({ forbiddenWords: value })}
                  placeholder="barato, imperdível"
                  tone="danger"
                />
              </Field>
            </div>
          )}

          {current.key === "canais" && (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2.5">
                <span className="text-[13px] font-medium text-ink">Canais</span>
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
                          selected
                            ? "border-accent bg-accent-soft text-accent-ink"
                            : "border-line text-ink-2 hover:border-accent hover:text-ink",
                        )}
                      >
                        {channel}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <span className="text-[13px] font-medium text-ink">Formatos</span>
                <div className="flex flex-col gap-2">
                  {FORMATS.map((format) => {
                    const selected = draft.formats.includes(format);
                    return (
                      <label key={format} className="flex cursor-pointer items-center gap-2.5">
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(checked) =>
                            patch({
                              formats: checked
                                ? [...draft.formats, format]
                                : draft.formats.filter((item) => item !== format),
                            })
                          }
                          aria-label={FORMAT_LABEL[format]}
                        />
                        <span className="text-[13.5px] text-ink">{FORMAT_LABEL[format]}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {current.key === "frequencia" && (
            <div className="flex flex-col gap-3">
              {CADENCES.map((cadence) => (
                <button
                  key={cadence}
                  type="button"
                  onClick={() => patch({ cadence })}
                  aria-pressed={draft.cadence === cadence}
                  className={cn(
                    "flex items-center gap-3 rounded-[12px] border px-4 py-3.5 text-left transition-colors",
                    draft.cadence === cadence
                      ? "border-accent bg-accent-soft"
                      : "border-line bg-card hover:border-line-contrast",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border",
                      draft.cadence === cadence ? "border-accent bg-accent" : "border-line-contrast",
                    )}
                  >
                    {draft.cadence === cadence && <Check className="h-2.5 w-2.5 text-surface" />}
                  </span>
                  <span className="text-[14px] text-ink">{cadence}</span>
                </button>
              ))}
              <Hint>Isso vira a sugestão de rotina depois. Nada é gerado sem você autorizar.</Hint>
            </div>
          )}

          {current.key === "revisao" && (
            <div className="flex flex-col gap-4">
              <div className="rounded-[14px] border border-line-strong bg-card">
                {[
                  ["Marca", draft.company],
                  ["Site", draft.website || "—"],
                  ["Segmento", draft.segment || "—"],
                  ["Descrição", draft.description || "—"],
                  ["Produtos", draft.products.map((product) => product.name).filter(Boolean).join(" · ") || "—"],
                  ["Público", draft.audience || "—"],
                  ["Tom de voz", draft.voiceTone || "—"],
                  ["Palavras proibidas", draft.forbiddenWords.join(", ") || "nenhuma"],
                  ["Canais", draft.channels.join(" · ") || "—"],
                  ["Formatos", draft.formats.join(" · ") || "—"],
                  ["Frequência", draft.cadence],
                ].map(([label, value], index, all) => (
                  <div
                    key={label}
                    className={cn(
                      "flex flex-col gap-1 px-4 py-3 md:flex-row md:gap-6",
                      index < all.length - 1 && "border-b border-line-soft",
                    )}
                  >
                    <span className="label-mono md:w-[150px] md:shrink-0 md:pt-0.5">{label}</span>
                    <span className="text-[13.5px] leading-relaxed text-ink">{value}</span>
                  </div>
                ))}
              </div>

              <Notice>
                Tudo isso é a memória da marca — a base de cada campanha. Você edita quando quiser em Minha Marca.
              </Notice>
            </div>
          )}

          <InlineError>{error}</InlineError>

          {/* ------------------------------------------------------- navegação */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              type="button"
              variant="quiet"
              onClick={() => setStep((value) => Math.max(0, value - 1))}
              disabled={step === 0}
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
              Voltar
            </Button>

            <div className="ml-auto flex items-center gap-2">
              {!current.required && step < STEPS.length - 1 && (
                <Button type="button" variant="ghost" onClick={() => setStep((value) => value + 1)}>
                  Pular
                </Button>
              )}
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={() => setStep((value) => value + 1)} disabled={!canAdvance}>
                  Continuar
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              ) : (
                <Button type="button" onClick={finish} loading={saving} disabled={!canAdvance}>
                  {!saving && <Sparkles className="h-4 w-4" aria-hidden />}
                  Criar minha marca
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>
        </>
      )}
    </div>
  );
}

/** O que a leitura do site encontrou, para o usuário confirmar antes de seguir. */
function PainelDetectado({ dados }: { dados: Detectado }) {
  const temAlgo = dados.colors.length > 0 || dados.fonts.headline || dados.shopify || dados.logoPath;
  if (!temAlgo) {
    return (
      <Notice tone="warning">
        Encontramos pouca coisa nessa página. Preencha manualmente — leva um minuto.
      </Notice>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-[14px] border border-accent/30 bg-accent-soft/40 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <MonoLabel className="text-accent">Lemos seu site</MonoLabel>
        {dados.shopify && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11.5px] text-ink-2">
            <ShoppingBag className="h-3 w-3" aria-hidden />
            Loja Shopify
          </span>
        )}
        {!dados.textoOk ? (
          <span className="text-[11.5px] text-warning">
            descrição e tom não foram interpretados — falta a chave de IA
          </span>
        ) : dados.confidence === "baixa" ? (
          <span className="text-[11.5px] text-warning">confira com atenção</span>
        ) : null}
      </div>

      {dados.colors.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="label-mono">
            Paleta · de {dados.stylesheets} {dados.stylesheets === 1 ? "folha de estilo" : "folhas de estilo"}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {dados.colors.map((cor) => (
              <span
                key={cor.hex + cor.role}
                className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1.5 pr-2.5"
              >
                <span aria-hidden className="h-4 w-4 rounded-full border border-line" style={{ background: cor.hex }} />
                <span className="font-mono text-[11px] uppercase text-ink-2">{cor.hex}</span>
                <span className="text-[10.5px] text-ink-faint">{cor.role}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {(dados.fonts.headline || dados.fonts.body) && (
        <div className="flex flex-col gap-1.5">
          <span className="label-mono">Tipografia</span>
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink">
            <Type className="h-3.5 w-3.5 text-ink-faint" aria-hidden />
            {dados.fonts.headline && <span>Títulos: <strong className="font-medium">{dados.fonts.headline}</strong></span>}
            {dados.fonts.body && <span>· Texto: <strong className="font-medium">{dados.fonts.body}</strong></span>}
          </div>
        </div>
      )}

      {dados.logoPath && (
        <div className="flex items-center gap-2">
          <Check className="h-3.5 w-3.5 text-positive" aria-hidden />
          <span className="text-[13px] text-ink-2">Logo do site importada.</span>
        </div>
      )}

      {dados.shopify && dados.shopify.products.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="label-mono">
            {dados.shopify.products.length} produtos importados da loja
          </span>
          <ul className="flex flex-col gap-1">
            {dados.shopify.products.slice(0, 5).map((produto) => (
              <li key={produto.name} className="flex items-baseline gap-2 text-[13px] text-ink">
                <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-accent" />
                <span className="truncate">{produto.name}</span>
                {produto.price_cents !== null && (
                  <span className="ml-auto shrink-0 font-mono text-[11.5px] text-ink-muted">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: dados.shopify!.currency || "BRL",
                    }).format(produto.price_cents / 100)}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {dados.shopify.products.length > 5 && (
            <Hint>e mais {dados.shopify.products.length - 5}. Você revisa todos na etapa de produtos.</Hint>
          )}
        </div>
      )}

      <Hint>Tudo é editável nas próximas etapas. Nada é gravado antes de você concluir.</Hint>
    </div>
  );
}

/** Completude da marca: sinal simples, sem gamificação. */
export function completeness(draft: {
  company: string; website: string; segment: string; description: string;
  colors: unknown[]; logoPath: string | null; products: unknown[];
  audience: string; voiceTone: string; channels: unknown[]; formats: unknown[];
}): number {
  const checks = [
    draft.company.trim().length > 1,
    draft.website.trim().length > 0,
    draft.segment.trim().length > 0,
    draft.description.trim().length > 0,
    draft.colors.length > 0,
    Boolean(draft.logoPath),
    draft.products.length > 0,
    draft.audience.trim().length > 0,
    draft.voiceTone.trim().length > 0,
    draft.channels.length > 0,
    draft.formats.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
