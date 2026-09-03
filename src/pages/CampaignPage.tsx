import * as React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, ImageIcon, Layers, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Divider } from "@/components/ui/surface";
import { Tabs, TabsList, TabsTrigger, TabsContent, Checkbox } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/overlays";
import { MonoLabel, Hint } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock, InlineError, Notice } from "@/components/ui/states";
import { BriefEditor } from "@/features/campaigns/BriefEditor";
import { DirectionCard } from "@/features/campaigns/DirectionCard";
import { AssetCard } from "@/features/creatives/AssetCard";
import { PerformancePanel } from "@/features/performance/PerformancePanel";
import { useCampaign } from "@/features/campaigns/queries";
import { useSignedUrls, useBrandLogoUrl } from "@/features/creatives/useAssetUrls";
import { CAMPAIGN_STATUS } from "@/features/creatives/status";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { callFunction, functionErrorMessage } from "@/lib/functions";
import { briefSchema, FORMATS, FORMAT_LABEL, type Format } from "@/lib/schemas";
import { available, canAfford, quotaMessage } from "@/lib/quotas";
import {
  IMAGE_QUALITIES,
  IMAGE_QUALITY,
  DEFAULT_IMAGE_QUALITY,
  estimatedCost,
  type ImageQuality,
} from "@/lib/image-quality";
import { formatUSD } from "@/lib/utils";

export default function CampaignPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { workspaceId, quota, plan } = useWorkspace();

  const { data, isLoading, error, refetch } = useCampaign(campaignId);
  const [generating, setGenerating] = React.useState(false);
  const [generatingImages, setGeneratingImages] = React.useState(false);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [imageDialog, setImageDialog] = React.useState(false);
  const [formats, setFormats] = React.useState<Format[]>(["4:5"]);
  const [quality, setQuality] = React.useState<ImageQuality>(DEFAULT_IMAGE_QUALITY);
  const [actionError, setActionError] = React.useState("");
  const autoStarted = React.useRef(false);

  const logo = useBrandLogoUrl();
  const assetPaths = React.useMemo(() => (data?.assets ?? []).map((asset) => asset.base_path), [data?.assets]);
  const urls = useSignedUrls("creative-assets", assetPaths);

  const generateDirections = React.useCallback(async () => {
    if (!workspaceId || !campaignId) return;
    setGenerating(true);
    setActionError("");
    try {
      await callFunction("generate-directions", {
        workspace_id: workspaceId,
        campaign_id: campaignId,
        count: 4,
      });
      await queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      toast.success("Caminhos criativos prontos");
    } catch (generateError) {
      setActionError(functionErrorMessage(generateError));
    } finally {
      setGenerating(false);
    }
  }, [workspaceId, campaignId, queryClient]);

  // Vindo da conversa com ?gerar=1: dispara uma vez e limpa o parâmetro.
  React.useEffect(() => {
    if (
      searchParams.get("gerar") === "1" &&
      !autoStarted.current &&
      data &&
      data.directions.length === 0 &&
      data.brief?.confirmed_at
    ) {
      autoStarted.current = true;
      setSearchParams({}, { replace: true });
      void generateDirections();
    }
  }, [searchParams, data, generateDirections, setSearchParams]);

  async function generateImages() {
    if (!workspaceId || !campaignId || selected.length === 0) return;
    setGeneratingImages(true);
    setActionError("");
    try {
      const result = await callFunction<{ assets: unknown[]; failed: number }>("generate-image", {
        workspace_id: workspaceId,
        campaign_id: campaignId,
        direction_ids: selected,
        formats,
        template_key: "produto-destaque",
        copy_variant: 0,
        quality,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] }),
        queryClient.invalidateQueries({ queryKey: ["quota"] }),
      ]);
      setImageDialog(false);
      setSelected([]);
      toast.success(
        result.failed
          ? `${result.assets.length} criativos gerados · ${result.failed} falharam e o crédito voltou`
          : `${result.assets.length} criativos gerados`,
      );
    } catch (imageError) {
      setActionError(functionErrorMessage(imageError));
    } finally {
      setGeneratingImages(false);
    }
  }

  if (isLoading) return <LoadingBlock label="Abrindo a campanha" className="min-h-[60dvh]" />;

  if (error || !data) {
    return (
      <div className="px-5 py-8 md:px-8">
        <ErrorState
          title="Campanha não encontrada"
          description="Ela pode ter sido arquivada ou pertencer a outro workspace."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  const { campaign, brief, directions, assets, reports } = data;
  const status = CAMPAIGN_STATUS[campaign.status];
  const parsedBrief = brief?.payload ? briefSchema.safeParse(brief.payload) : null;

  const imagesLeft = quota && plan ? available(quota, plan, "imagem") : null;
  const enoughCredits = !quota || !plan || canAfford(quota, plan, "imagem", selected.length);
  const quotaHint = quota && plan ? quotaMessage(quota, plan, "imagem", selected.length) : null;

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-5 py-6 md:px-8 md:py-8">
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="self-start px-0" onClick={() => navigate("/app/campanhas")}>
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Campanhas
        </Button>

        <div className="flex flex-wrap items-start gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <MonoLabel className="text-accent">
              {campaign.origin === "rotina" ? "Gerada por rotina" : "Criada por conversa"}
            </MonoLabel>
            <h1 className="text-[26px] font-normal leading-tight tracking-[-0.025em] text-ink md:text-[32px]">
              {campaign.name}
            </h1>
          </div>
          <Badge tone={status.tone} className="mt-1">
            {status.label}
          </Badge>
        </div>
      </div>

      <InlineError>{actionError}</InlineError>

      <Tabs defaultValue={assets.length ? "criativos" : "caminhos"}>
        <TabsList>
          <TabsTrigger value="caminhos">Caminhos {directions.length > 0 && `· ${directions.length}`}</TabsTrigger>
          <TabsTrigger value="criativos">Criativos {assets.length > 0 && `· ${assets.length}`}</TabsTrigger>
          <TabsTrigger value="resultados">Resultados {reports.length > 0 && `· ${reports.length}`}</TabsTrigger>
          <TabsTrigger value="briefing">Briefing</TabsTrigger>
        </TabsList>

        <TabsContent value="caminhos" className="pt-5">
          {directions.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title={generating ? "Gerando os caminhos criativos" : "Nenhum caminho gerado ainda"}
              description={
                generating
                  ? "O modelo estratégico está lendo a memória da marca e propondo hipóteses diferentes."
                  : "A partir do briefing confirmado, geramos de 3 a 5 caminhos com hipóteses distintas e copies. Esta etapa não usa crédito de imagem."
              }
              action={
                <Button onClick={generateDirections} loading={generating} disabled={!brief?.confirmed_at}>
                  {!generating && <Sparkles className="h-4 w-4" aria-hidden />}
                  Gerar caminhos criativos
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-3 rounded-[12px] border border-line bg-sunken px-4 py-3">
                <span className="text-[13px] text-ink-2">
                  {selected.length === 0
                    ? "Selecione os caminhos que valem virar imagem."
                    : `${selected.length} ${selected.length === 1 ? "caminho selecionado" : "caminhos selecionados"}`}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={generateDirections} loading={generating}>
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                    Novos caminhos
                  </Button>
                  <Button size="sm" disabled={selected.length === 0} onClick={() => setImageDialog(true)}>
                    <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                    Gerar imagens
                  </Button>
                </div>
              </div>

              {directions.map((direction) => (
                <DirectionCard
                  key={direction.id}
                  direction={direction}
                  selected={selected.includes(direction.id)}
                  onSelectedChange={(value) =>
                    setSelected((current) =>
                      value ? [...current, direction.id] : current.filter((id) => id !== direction.id),
                    )
                  }
                  disabled={selected.length >= 5 && !selected.includes(direction.id)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="criativos" className="pt-5">
          {assets.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Nenhum criativo gerado"
              description="Escolha os caminhos na aba anterior e gere as imagens. Cada caminho consome uma imagem-base; as adaptações de formato saem sem custo."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  imageUrl={urls.data?.get(asset.base_path ?? "") ?? null}
                  logoUrl={logo.data ?? null}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="resultados" className="pt-5">
          <PerformancePanel
            campaignId={campaign.id}
            brandId={campaign.brand_id}
            reports={reports}
            assets={assets}
          />
        </TabsContent>

        <TabsContent value="briefing" className="pt-5">
          {parsedBrief?.success ? (
            <BriefEditor brief={parsedBrief.data} readOnly />
          ) : (
            <EmptyState title="Sem briefing" description="Esta campanha ainda não tem um briefing salvo." />
          )}
        </TabsContent>
      </Tabs>

      {/* Confirmação de custo antes de qualquer geração de imagem */}
      <Dialog open={imageDialog} onOpenChange={setImageDialog}>
        <DialogContent title="Gerar imagens" description="Confira o que será consumido antes de continuar.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2.5">
              <MonoLabel>Formatos</MonoLabel>
              <div className="flex flex-col gap-2">
                {FORMATS.map((format) => (
                  <label key={format} className="flex cursor-pointer items-center gap-2.5">
                    <Checkbox
                      checked={formats.includes(format)}
                      onCheckedChange={(checked) =>
                        setFormats((current) =>
                          checked ? [...current, format] : current.filter((item) => item !== format),
                        )
                      }
                      aria-label={FORMAT_LABEL[format]}
                    />
                    <span className="text-[13.5px] text-ink">{FORMAT_LABEL[format]}</span>
                    {formats[0] === format && <span className="label-mono">imagem-base</span>}
                  </label>
                ))}
              </div>
              <Hint>
                Só o primeiro formato gera imagem. Os outros são adaptações de composição e não consomem crédito.
              </Hint>
            </div>

            <Divider />

            <div className="flex flex-col gap-2.5">
              <MonoLabel>Qualidade da imagem</MonoLabel>
              <div className="flex flex-col gap-2">
                {IMAGE_QUALITIES.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setQuality(level)}
                    aria-pressed={quality === level}
                    className={`flex flex-col gap-0.5 rounded-[10px] border px-3.5 py-2.5 text-left transition-colors ${
                      quality === level ? "border-accent bg-accent-soft" : "border-line hover:border-line-contrast"
                    }`}
                  >
                    <span className="flex items-baseline gap-2">
                      <span className="text-[13.5px] text-ink">{IMAGE_QUALITY[level].label}</span>
                      <span className="ml-auto font-mono text-[11.5px] text-ink-2">
                        {formatUSD(IMAGE_QUALITY[level].costUsd)} por imagem
                      </span>
                    </span>
                    <span className="text-[12px] leading-relaxed text-ink-muted">
                      {IMAGE_QUALITY[level].description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Divider />

            <dl className="flex flex-col gap-2.5">
              <Row label="Créditos consumidos" value={`${selected.length} ${selected.length === 1 ? "imagem" : "imagens"}`} />
              <Row label="Custo estimado" value={formatUSD(estimatedCost(quality, selected.length))} />
              <Row
                label="Restam no ciclo"
                value={imagesLeft === null ? "—" : `${imagesLeft} ${imagesLeft === 1 ? "imagem" : "imagens"}`}
              />
            </dl>

            <Notice>
              <strong className="font-medium text-ink">O que é mantido:</strong> copies, hooks e prompts dos caminhos
              escolhidos.
              <br />
              <strong className="font-medium text-ink">O que é criado:</strong> uma imagem-base por caminho, com a
              composição do CreatvOS por cima.
            </Notice>

            {quotaHint && !quotaHint.ok && <Notice tone="warning">{quotaHint.message}</Notice>}
          </div>

          <DialogFooter>
            <Button variant="quiet" onClick={() => setImageDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={generateImages}
              loading={generatingImages}
              disabled={!enoughCredits || formats.length === 0}
            >
              Gerar {selected.length} {selected.length === 1 ? "imagem" : "imagens"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd className="ml-auto text-[13.5px] text-ink">{value}</dd>
    </div>
  );
}
