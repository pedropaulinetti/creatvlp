import * as React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Check, ImageIcon, Layers, Maximize2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Divider } from "@/components/ui/surface";
import { Tabs, TabsList, TabsTrigger, TabsContent, Checkbox } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/overlays";
import { MonoLabel, Hint } from "@/components/ui/field";
import { EmptyState, ErrorState, LoadingBlock, InlineError, Notice, Spinner } from "@/components/ui/states";
import { BriefEditor } from "@/features/campaigns/BriefEditor";
import { DirectionCard } from "@/features/campaigns/DirectionCard";
import { AssetCard } from "@/features/creatives/AssetCard";
import { agruparPorIdeia } from "@/features/creatives/agrupar";
import { PerformancePanel } from "@/features/performance/PerformancePanel";
import { useCampaign } from "@/features/campaigns/queries";
import { useSignedUrls, useBrandLogoUrl } from "@/features/creatives/useAssetUrls";
import { useReferencias, useReferenciaAmpliada, POR_PAGINA } from "@/features/creatives/useReferencias";
import { CAMPAIGN_STATUS } from "@/features/creatives/status";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { callFunction, functionErrorMessage } from "@/lib/functions";
import { briefSchema, FORMATS, FORMAT_LABEL, type Format } from "@/lib/schemas";
import { available, canAfford, quotaMessage } from "@/lib/quotas";

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
  const [quantidade, setQuantidade] = React.useState(3);
  const [progresso, setProgresso] = React.useState("");
  /* Layouts escolhidos à mão. Vazio: o sistema varia sozinho pelo acervo. */
  const [layouts, setLayouts] = React.useState<string[]>([]);
  const [escolhendoLayout, setEscolhendoLayout] = React.useState(false);
  /* A referência aberta em tamanho grande. Marcar e ver de perto são coisas diferentes. */
  const [ampliada, setAmpliada] = React.useState<{ path: string; origem: string } | null>(null);
  const [paginas, setPaginas] = React.useState(1);
  const [actionError, setActionError] = React.useState("");
  const autoStarted = React.useRef(false);

  const logo = useBrandLogoUrl();
  const acervo = useReferencias(escolhendoLayout, paginas);
  const grande = useReferenciaAmpliada(ampliada?.path ?? null);
  // A fotografia de fundo e, quando existe, a peça inteira desenhada pelo modelo.
  const assetPaths = React.useMemo(
    () => (data?.assets ?? []).flatMap((asset) => [asset.base_path, asset.generated_path]),
    [data?.assets],
  );
  const urls = useSignedUrls("creative-assets", assetPaths);

  /**
   * `novos` separa as duas intenções que chegam neste mesmo botão.
   *
   * Sem ele, a chave de idempotência é a da versão do briefing: repetir o
   * pedido devolve o job anterior, que é o que protege o clique duplo e a
   * volta da conversa com `?gerar=1`. Com ele, a chave é única — e era
   * justamente a falta dela que fazia "Novos caminhos" não gerar nada: o
   * servidor reaproveitava o job já concluído e a tela continuava idêntica.
   */
  const generateDirections = React.useCallback(
    async ({ novos = false }: { novos?: boolean } = {}) => {
      if (!workspaceId || !campaignId) return;
      setGenerating(true);
      setActionError("");
      try {
        /*
         * Sem `count`: quantos caminhos gerar sai do briefing, na função. Fixar
         * quatro aqui era o motivo de a quantidade pedida na conversa não
         * desencadear nada.
         */
        const resultado = await callFunction<{ reused?: boolean }>(
          "generate-directions",
          { workspace_id: workspaceId, campaign_id: campaignId },
          novos ? { idempotencyKey: `direcoes:${campaignId}:novos:${Date.now()}` } : {},
        );
        await queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
        if (resultado?.reused) {
          toast.info("Estes já são os caminhos desta versão do briefing.");
          return;
        }
        // Os caminhos propostos foram substituídos: a seleção anterior morreu com eles.
        setSelected([]);
        toast.success("Caminhos criativos prontos");
      } catch (generateError) {
        const mensagem = functionErrorMessage(generateError);
        setActionError(mensagem);
        // Também em toast: o aviso fica no topo da página, longe de quem clicou.
        toast.error(mensagem);
      } finally {
        setGenerating(false);
      }
    },
    [workspaceId, campaignId, queryClient],
  );

  /*
   * A quantidade do briefing entra como valor inicial do diálogo.
   *
   * Ela foi perguntada na conversa; reperguntar do zero seria pedir duas vezes
   * a mesma coisa. Continua editável — o briefing é ponto de partida, não
   * contrato.
   */
  const quantidadeDoBriefing = React.useMemo(() => {
    const payload = data?.brief?.payload as { quantity?: unknown } | null | undefined;
    return typeof payload?.quantity === "number" ? payload.quantity : null;
  }, [data?.brief?.payload]);

  React.useEffect(() => {
    if (quantidadeDoBriefing) setQuantidade(quantidadeDoBriefing);
  }, [quantidadeDoBriefing]);

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

  /*
   * A quantidade pedida no briefing é a quantidade entregue.
   *
   * Cada peça é uma geração inteira — layout, texto e produto na mesma imagem —
   * e por isso vale um crédito. Não há mais "três peças pelo preço de uma": o
   * que havia era a mesma fotografia recomposta três vezes, e era isso que
   * fazia toda campanha sair com o mesmo desenho.
   */
  const MAX_GERACOES_POR_LOTE = 10;

  async function generateImages() {
    if (!workspaceId || !campaignId || selected.length === 0 || quantidade < 1) return;
    setGeneratingImages(true);
    setActionError("");

    /*
     * A função morre aos 150 segundos, e o que pesa é a geração: uma peça em
     * dois formatos são dois desenhos. O lote é medido em peças que cabem.
     */
    const porFormato = Math.max(1, formats.length);
    const pecasPorLote = Math.max(1, Math.floor(MAX_GERACOES_POR_LOTE / porFormato));

    const lotes: number[] = [];
    for (let restam = quantidade; restam > 0; restam -= pecasPorLote) {
      lotes.push(Math.min(restam, pecasPorLote));
    }

    let geradas = 0;
    let falhas = 0;

    /*
     * O diálogo fecha antes de começar, não depois de terminar.
     *
     * Ficava aberto e travado pelos minutos inteiros da geração, e quem pediu
     * trinta peças olhava para um botão girando sem ver nada acontecer. As
     * peças já nascem uma a uma no banco: o que faltava era a tela mostrar.
     */
    setImageDialog(false);

    try {
      for (const [indice, doLote] of lotes.entries()) {
        setProgresso(
          lotes.length > 1 ? `Gerando ${geradas + 1}–${geradas + doLote} de ${quantidade}` : "",
        );

        const result = await callFunction<{ assets: unknown[]; failed: number }>("generate-image", {
          workspace_id: workspaceId,
          campaign_id: campaignId,
          direction_ids: selected,
          formats,
          quantidade: doLote,
          reference_keys: layouts,
          lote: indice,
        });

        geradas += result.assets.length;
        falhas += result.failed;

        /*
         * Recarrega a cada lote, e não só no fim: as peças do lote 1 aparecem
         * enquanto o lote 2 ainda está desenhando. Numa geração de trinta
         * peças são três esperas curtas em vez de uma longa e cega.
         */
        await queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      }

      await queryClient.invalidateQueries({ queryKey: ["quota"] });
      setSelected([]);
      toast.success(
        falhas
          ? `${geradas} peças geradas · ${falhas} falharam e o crédito voltou`
          : `${geradas} ${geradas === 1 ? "peça gerada" : "peças geradas"}`,
      );
    } catch (imageError) {
      setActionError(functionErrorMessage(imageError));
      if (geradas > 0) {
        await queryClient.invalidateQueries({ queryKey: ["campaign", campaignId] });
      }
    } finally {
      setProgresso("");
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
  // Cada formato de cada peça é um desenho próprio, e cada desenho é um crédito.
  const geracoes = quantidade * Math.max(1, formats.length);
  const enoughCredits = !quota || !plan || canAfford(quota, plan, "imagem", geracoes);
  const quotaHint = quota && plan ? quotaMessage(quota, plan, "imagem", geracoes) : null;

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

      {/*
        O andamento vive na página, não no diálogo.
        
        Ficava dentro do modal, que prendia a tela inteira até a última peça.
        Aqui ele acompanha enquanto você olha o que já saiu, e as peças dos
        lotes anteriores aparecem na aba Criativos conforme nascem.
      */}
      {generatingImages && (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-line bg-sunken px-3.5 py-2.5">
          <Spinner className="h-3.5 w-3.5" />
          <span className="text-[13px] text-ink">
            {progresso || "Desenhando as peças"}
          </span>
          <span className="ml-auto text-[12px] text-ink-muted">
            As peças aparecem aqui conforme ficam prontas.
          </span>
        </div>
      )}

      <Tabs defaultValue={assets.length ? "criativos" : "caminhos"}>
        <TabsList>
          <TabsTrigger value="caminhos">Caminhos {directions.length > 0 && `· ${directions.length}`}</TabsTrigger>
          <TabsTrigger value="criativos">Criativos {assets.length > 0 && `· ${agruparPorIdeia(assets).length}`}</TabsTrigger>
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
                <Button onClick={() => generateDirections()} loading={generating} disabled={!brief?.confirmed_at}>
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
                  <Button variant="outline" size="sm" onClick={() => generateDirections({ novos: true })} loading={generating}>
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
              description="Escolha os caminhos na aba anterior e gere as peças. Cada peça é um anúncio inteiro desenhado do zero — layout, texto e produto na mesma imagem — e cada uma consome um crédito."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {agruparPorIdeia(assets).map(({ principal, irmas }) => (
                <AssetCard
                  key={principal.id}
                  asset={principal}
                  irmas={irmas}
                  imageUrl={urls.data?.get(principal.base_path ?? "") ?? null}
                  generatedUrl={urls.data?.get(principal.generated_path ?? "") ?? null}
                  urlPorFormato={
                    new Map(
                      [principal, ...irmas].flatMap((item) => {
                        const url = urls.data?.get(item.generated_path ?? "");
                        return url ? [[item.format, url] as [string, string]] : [];
                      }),
                    )
                  }
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

      {/* A referência de perto: só para olhar, sem marcar nada. */}
      <Dialog open={Boolean(ampliada)} onOpenChange={(aberto) => !aberto && setAmpliada(null)}>
        <DialogContent title={ampliada?.origem || "Referência de layout"} description="Desta peça o sistema aproveita só a estrutura — nunca a marca, o texto ou o produto.">
          {grande.data ? (
            <img src={grande.data} alt="" className="mx-auto max-h-[70dvh] w-auto rounded-[10px]" />
          ) : (
            <LoadingBlock label="Carregando a referência" />
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmação de custo antes de qualquer geração de imagem */}
      <Dialog open={imageDialog} onOpenChange={setImageDialog}>
        <DialogContent title="Gerar imagens" description="Confira o que será consumido antes de continuar.">
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2.5">
              <MonoLabel>Quantas peças</MonoLabel>
              <input
                type="number"
                min={1}
                max={30}
                value={quantidade}
                onChange={(event) =>
                  setQuantidade(Math.min(30, Math.max(1, Number(event.target.value) || 1)))
                }
                aria-label="Quantidade de peças"
                className="w-24 rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink focus:border-accent focus:outline-none"
              />
              <Hint>
                {quantidadeDoBriefing
                  ? `Veio do briefing: ${quantidadeDoBriefing} ${quantidadeDoBriefing === 1 ? "peça" : "peças"}. Dá para mudar aqui.`
                  : "Cada peça é uma geração completa e vale um crédito."}
              </Hint>
            </div>

            <Divider />

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
                  </label>
                ))}
              </div>
              <Hint>
                Cada peça sai em todos os formatos marcados — e cada formato é um desenho novo, não um recorte.
              </Hint>
            </div>

            <Divider />

            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2">
                <MonoLabel>Layout</MonoLabel>
                <button
                  type="button"
                  onClick={() => setEscolhendoLayout((atual) => !atual)}
                  className="ml-auto text-[12.5px] text-accent underline-offset-2 hover:underline"
                >
                  {escolhendoLayout ? "Deixar automático" : "Escolher layouts"}
                </button>
              </div>

              {!escolhendoLayout ? (
                <Hint>
                  O sistema varia sozinho entre as referências do seu segmento, sem repetir enquanto o acervo aguentar.
                </Hint>
              ) : acervo.isLoading ? (
                <LoadingBlock label="Carregando o acervo" />
              ) : !acervo.data?.itens.length ? (
                <Hint>
                  Nenhuma referência cadastrada para este segmento. A geração continua funcionando com as formas
                  descritas no prompt.
                </Hint>
              ) : (
                <>
                  {/*
                    Três colunas e a peça inteira, não recortada.
                    Com `object-cover` numa coluna estreita, um anúncio de
                    1080×1920 virava uma tira do meio: dava para ver que havia
                    texto, nunca qual era o layout. Escolher layout pede ver o
                    layout.
                  */}
                  <div className="grid max-h-[400px] grid-cols-3 gap-2 overflow-y-auto rounded-[10px] border border-line bg-sunken p-2">
                    {acervo.data.itens.map((referencia) => {
                      const marcada = layouts.includes(referencia.key);
                      return (
                        <button
                          key={referencia.key}
                          type="button"
                          aria-pressed={marcada}
                          aria-label={`Layout ${referencia.origem || referencia.key}`}
                          onClick={() =>
                            setLayouts((atual) =>
                              marcada
                                ? atual.filter((item) => item !== referencia.key)
                                : [...atual, referencia.key],
                            )
                          }
                          className={`group relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[8px] border-2 bg-card transition-colors ${
                            marcada ? "border-accent" : "border-line hover:border-line-contrast"
                          }`}
                        >
                          {referencia.url && (
                            <img
                              src={referencia.url}
                              alt=""
                              loading="lazy"
                              className="max-h-full max-w-full object-contain"
                            />
                          )}

                          {marcada && (
                            <span
                              aria-hidden
                              className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-surface"
                            >
                              <Check className="h-3 w-3" />
                            </span>
                          )}

                          {/*
                            Clicar marca; a lupa amplia. Sem a segunda ação não
                            dá para saber o que se está marcando — a miniatura
                            mostra a forma, não o detalhe.
                          */}
                          {referencia.url && (
                            <span
                              role="button"
                              tabIndex={0}
                              aria-label="Ver em tamanho grande"
                              onClick={(event) => {
                                event.stopPropagation();
                                setAmpliada({ path: referencia.storage_path, origem: referencia.origem });
                              }}
                              onKeyDown={(event) => {
                                if (event.key !== "Enter" && event.key !== " ") return;
                                event.preventDefault();
                                event.stopPropagation();
                                setAmpliada({ path: referencia.storage_path, origem: referencia.origem });
                              }}
                              className="absolute left-1.5 top-1.5 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-ink/70 text-surface opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                            >
                              <Maximize2 className="h-3 w-3" aria-hidden />
                            </span>
                          )}

                          {referencia.origem && (
                            <span className="absolute inset-x-0 bottom-0 truncate bg-ink/70 px-1.5 py-0.5 text-[10px] text-surface">
                              {referencia.origem}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {acervo.data.itens.length < acervo.data.total && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="self-center"
                      loading={acervo.isFetching}
                      onClick={() => setPaginas((atual) => atual + 1)}
                    >
                      Ver mais {Math.min(POR_PAGINA, acervo.data.total - acervo.data.itens.length)} de{" "}
                      {acervo.data.total}
                    </Button>
                  )}

                  <div className="flex items-baseline gap-3">
                    <Hint>
                      {layouts.length === 0
                        ? `Nenhum marcado: o sistema varia entre as ${acervo.data.total} referências do seu segmento.`
                        : `${layouts.length} ${layouts.length === 1 ? "layout marcado" : "layouts marcados"} — as peças giram só entre eles.`}
                    </Hint>
                    {layouts.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setLayouts([])}
                        className="ml-auto shrink-0 text-[12px] text-ink-muted underline-offset-2 hover:text-ink hover:underline"
                      >
                        Limpar
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <Divider />

            <dl className="flex flex-col gap-2.5">
              <Row
                label="Peças entregues"
                value={
                  formats.length > 1
                    ? `${geracoes} — ${quantidade} ${quantidade === 1 ? "peça" : "peças"} × ${formats.length} formatos`
                    : `${quantidade} ${quantidade === 1 ? "peça" : "peças"}`
                }
              />
              <Row label="Créditos consumidos" value={`${geracoes} — uma imagem, um crédito`} />
              <Row
                label="Restam no ciclo"
                value={imagesLeft === null ? "—" : `${imagesLeft} ${imagesLeft === 1 ? "imagem" : "imagens"}`}
              />
            </dl>

            <Notice>
              <strong className="font-medium text-ink">O que é mantido:</strong> copies, hooks e prompts dos caminhos
              escolhidos.
              <br />
              <strong className="font-medium text-ink">O que é criado:</strong> {geracoes}{" "}
              {geracoes === 1 ? "anúncio inteiro" : "anúncios inteiros"}, distribuídos entre {selected.length}{" "}
              {selected.length === 1 ? "caminho" : "caminhos"}
              {formats.length > 1 ? ", cada peça desenhada em cada formato marcado" : ""}.
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
              disabled={!enoughCredits || formats.length === 0 || quantidade < 1}
            >
              {progresso || `Gerar ${quantidade} ${quantidade === 1 ? "peça" : "peças"}`}
              {!progresso && formats.length > 1 && ` · ${geracoes} créditos`}
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
