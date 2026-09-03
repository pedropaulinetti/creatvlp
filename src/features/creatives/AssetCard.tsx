import * as React from "react";
import { toast } from "sonner";
import {
  Check, Download, Heart, MoreHorizontal, Pencil, RefreshCw, Star, Trash2, Wand2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { Checkbox } from "@/components/ui/controls";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger, Dialog, DialogContent, DialogFooter, Tooltip,
} from "@/components/ui/overlays";
import { CreativeCanvas, type Composition, emptyComposition } from "@/features/creatives/CreativeCanvas";
import { useAssetActions } from "@/features/creatives/mutations";
import { downloadNode, downloadUrl, safeFilename } from "@/features/creatives/export";
import { ASSET_STATUS } from "@/features/creatives/status";
import { Field, Input, Textarea, MonoLabel } from "@/components/ui/field";
import { FORMATS, FORMAT_LABEL, type Format } from "@/lib/schemas";
import { IMAGE_QUALITIES, IMAGE_QUALITY } from "@/lib/image-quality";
import { formatUSD } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/database.types";

type Asset = Database["public"]["Tables"]["creative_assets"]["Row"] & {
  variants?: Database["public"]["Tables"]["creative_variants"]["Row"][];
};

export function AssetCard({
  asset,
  irmas = [],
  imageUrl,
  generatedUrl,
  urlPorFormato,
  logoUrl,
  selected,
  onSelectedChange,
  compact = false,
}: {
  asset: Asset;
  /*
   * As outras versões de formato desta mesma peça.
   *
   * Cada formato é uma geração e uma linha própria no banco, mas para quem
   * olha são a mesma peça em dois tamanhos. Sem isto, os botões de formato do
   * card não tinham para onde ir — clicava em 9:16 e não acontecia nada.
   */
  irmas?: Asset[];
  imageUrl: string | null;
  /** A peça inteira desenhada pelo modelo, quando já foi pedida. */
  generatedUrl?: string | null;
  /** A URL assinada de cada formato desta peça. */
  urlPorFormato?: Map<string, string>;
  logoUrl: string | null;
  selected?: boolean;
  onSelectedChange?: (value: boolean) => void;
  compact?: boolean;
}) {
  const actions = useAssetActions();
  const [open, setOpen] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  /*
   * Criativo antigo — gerado quando a peça era fotografia mais composição em
   * HTML — não tem `generated_path`. Continua renderizando pelo caminho velho:
   * sem isso, campanha antiga vira card vazio.
   */
  const ehComposicaoAntiga = !asset.generated_path;
  const [reason, setReason] = React.useState("");
  const [format, setFormat] = React.useState<Format>((asset.format as Format) ?? "4:5");
  const canvasRef = React.useRef<HTMLDivElement>(null);

  const status = ASSET_STATUS[asset.status];

  const compositionFor = (target: Format): Composition => {
    if (target === asset.format) {
      return { ...emptyComposition(target), ...(asset.composition as object) } as Composition;
    }
    const variant = asset.variants?.find((item) => item.format === target);
    return {
      ...emptyComposition(target),
      ...(asset.composition as object),
      ...((variant?.composition as object) ?? {}),
      format: target,
    } as Composition;
  };

  const todasAsVersoes = React.useMemo(() => [asset, ...irmas], [asset, irmas]);

  const availableFormats = React.useMemo(() => {
    const set = new Set<Format>(todasAsVersoes.map((item) => item.format as Format));
    for (const variant of asset.variants ?? []) set.add(variant.format as Format);
    return FORMATS.filter((item) => set.has(item));
  }, [todasAsVersoes, asset.variants]);

  /** A peça do formato que está sendo olhado — cada uma é um arquivo próprio. */
  const versaoVisivel = React.useMemo(
    () => todasAsVersoes.find((item) => item.format === format) ?? asset,
    [todasAsVersoes, format, asset],
  );

  const urlVisivel = versaoVisivel.generated_path
    ? urlPorFormato?.get(versaoVisivel.format) ?? generatedUrl ?? null
    : null;

  async function download() {
    const nome = `${safeFilename(asset.id.slice(0, 8))}-${format.replace(":", "x")}.png`;
    try {
      // A peça desenhada já é o arquivo final; a composição antiga precisa ser
      // rasterizada a partir do DOM.
      if (!ehComposicaoAntiga && urlVisivel) return await downloadUrl(urlVisivel, nome);
      if (canvasRef.current) return await downloadNode(canvasRef.current, nome);
    } catch {
      toast.error("Não conseguimos exportar o PNG. Tente de novo.");
    }
  }

  return (
    <>
      <article
        className={cn(
          "group relative flex flex-col gap-3 rounded-[14px] border border-line bg-card p-3 transition-colors",
          selected && "border-accent",
        )}
      >
        {onSelectedChange && (
          <div
            className={cn(
              "absolute left-5 top-5 z-10 transition-opacity",
              selected ? "opacity-100" : "opacity-0 focus-within:opacity-100 group-hover:opacity-100",
            )}
          >
            <Checkbox
              checked={Boolean(selected)}
              onCheckedChange={onSelectedChange}
              aria-label={selected ? "Desmarcar criativo" : "Selecionar criativo"}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="overflow-hidden rounded-[10px] focus-visible:outline-2"
          aria-label="Abrir criativo"
        >
          {ehComposicaoAntiga ? (
            <CreativeCanvas
              ref={canvasRef}
              imageUrl={imageUrl}
              logoUrl={logoUrl}
              composition={compositionFor(format)}
              format={format}
              displayWidth={compact ? 200 : 260}
              className="mx-auto"
            />
          ) : (
            <img
              src={urlVisivel ?? ""}
              alt={(asset.composition as { headline?: string })?.headline || "Peça gerada"}
              className="mx-auto rounded-[10px]"
              style={{ width: compact ? 200 : 260 }}
            />
          )}
        </button>

        <div className="flex items-center gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          {asset.is_favorite && <Star className="h-3.5 w-3.5 fill-accent text-accent" aria-label="Favorito" />}
          <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
            {format}
          </span>
        </div>

        <p className="line-clamp-2 text-[13px] leading-snug text-ink">
          {(asset.composition as { headline?: string })?.headline || "Sem headline"}
        </p>

        {/*
          De qual layout esta peça saiu. É o que permite descobrir, olhando os
          resultados, qual estrutura converte — e repetir só ela na próxima.
        */}
        {!ehComposicaoAntiga && asset.template_key && asset.template_key !== "peca-livre" && (
          <span className="font-mono text-[10.5px] uppercase tracking-[0.08em] text-ink-faint">
            layout · {asset.template_key}
          </span>
        )}

        <div className="flex items-center gap-1.5">
          {asset.status !== "aprovado" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => actions.setStatus.mutate({ ids: todasAsVersoes.map((item) => item.id), status: "aprovado" })}
              loading={actions.setStatus.isPending}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Aprovar
            </Button>
          )}
          {asset.status !== "rejeitado" && (
            <Button size="sm" variant="quiet" onClick={() => setRejecting(true)}>
              <X className="h-3.5 w-3.5" aria-hidden />
              Rejeitar
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label="Mais ações"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-[7px] text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <MoreHorizontal className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setOpen(true)}>
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                Editar texto e gerar de novo
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download()}>
                <Download className="h-3.5 w-3.5" aria-hidden />
                Baixar PNG
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => actions.toggleFavorite.mutate({ id: asset.id, value: !asset.is_favorite })}
              >
                <Heart className="h-3.5 w-3.5" aria-hidden />
                {asset.is_favorite ? "Remover dos favoritos" : "Favoritar"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Gerar de novo</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => actions.regenerate.mutate({ assetId: asset.id, mode: "copy" })}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Reescrever o texto · sem crédito
              </DropdownMenuItem>
              {IMAGE_QUALITIES.map((level) => (
                <DropdownMenuItem
                  key={level}
                  onSelect={() =>
                    actions.regenerate.mutate({ assetId: asset.id, mode: "peca", quality: level })
                  }
                >
                  <Wand2 className="h-3.5 w-3.5" aria-hidden />
                  Redesenhar a peça · {IMAGE_QUALITY[level].label.toLowerCase()} · 1 crédito ·{" "}
                  {formatUSD(IMAGE_QUALITY[level].costUsd)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger" onSelect={() => actions.softDelete.mutate([asset.id])}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Mover para a lixeira
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {availableFormats.length > 1 && (
          <div className="flex items-center gap-1" role="group" aria-label="Formato">
            {availableFormats.map((item) => (
              <Tooltip key={item} label={FORMAT_LABEL[item]}>
                <button
                  type="button"
                  onClick={() => setFormat(item)}
                  aria-pressed={format === item}
                  className={cn(
                    "rounded-[6px] px-2 py-1 font-mono text-[10.5px] transition-colors",
                    format === item ? "bg-active text-ink" : "text-ink-faint hover:text-ink",
                  )}
                >
                  {item}
                </button>
              </Tooltip>
            ))}
          </div>
        )}
      </article>

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent title="Rejeitar criativo" description="O motivo vira aprendizado para as próximas gerações.">
          <Field label="Por que este criativo não serve?" htmlFor="motivo">
            <Textarea
              id="motivo"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="A imagem não mostra o produto, o tom ficou agressivo demais…"
            />
          </Field>
          <DialogFooter>
            <Button variant="quiet" onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={actions.setStatus.isPending}
              onClick={() => {
                actions.setStatus.mutate({
                  ids: todasAsVersoes.map((item) => item.id),
                  status: "rejeitado",
                  reason: reason.trim(),
                });
                setRejecting(false);
                setReason("");
              }}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AssetDetailDialog
        asset={asset}
        open={open}
        onOpenChange={setOpen}
        generatedUrl={urlVisivel}
        versaoVisivel={versaoVisivel}
        formatosDisponiveis={availableFormats}
        imageUrl={imageUrl}
        logoUrl={logoUrl}
        format={format}
        onFormatChange={setFormat}
        composition={compositionFor(format)}
      />
    </>
  );
}

function AssetDetailDialog({
  asset,
  versaoVisivel,
  formatosDisponiveis,
  open,
  onOpenChange,
  generatedUrl,
  imageUrl,
  logoUrl,
  format,
  onFormatChange,
  composition,
}: {
  asset: Asset;
  /** A peça do formato aberto: é ela que se baixa e se redesenha. */
  versaoVisivel: Asset;
  /** Só os formatos que existem de verdade — o resto seria botão morto. */
  formatosDisponiveis: Format[];
  open: boolean;
  onOpenChange: (value: boolean) => void;
  generatedUrl: string | null;
  imageUrl: string | null;
  logoUrl: string | null;
  format: Format;
  onFormatChange: (value: Format) => void;
  composition: Composition;
}) {
  const actions = useAssetActions();
  const [draft, setDraft] = React.useState<Composition>(composition);
  const canvasRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) setDraft(composition);
  }, [open, composition]);

  const patch = (values: Partial<Composition>) => setDraft((current) => ({ ...current, ...values }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        wide
        title="Editar criativo"
        description="A peça é desenhada por inteiro, então mudar o texto pede uma geração nova — e um crédito."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,260px)_1fr]">
          <div className="flex flex-col gap-3">
            {versaoVisivel.generated_path && generatedUrl ? (
              <img
                src={generatedUrl}
                alt={draft.headline || "Peça gerada"}
                className="rounded-[10px]"
                style={{ width: 240 }}
              />
            ) : (
              <CreativeCanvas
                ref={canvasRef}
                imageUrl={imageUrl}
                logoUrl={logoUrl}
                composition={draft}
                format={format}
                displayWidth={240}
              />
            )}
            {/*
              Só os formatos gerados. Listar os três sempre dava botão morto:
              clicar em 9:16 numa peça que só existe em 4:5 não fazia nada.
            */}
            <div className="flex flex-wrap items-center gap-1">
              {formatosDisponiveis.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => onFormatChange(item)}
                  aria-pressed={format === item}
                  className={cn(
                    "rounded-[6px] px-2 py-1 font-mono text-[10.5px] transition-colors",
                    format === item ? "bg-active text-ink" : "text-ink-faint hover:text-ink",
                  )}
                >
                  {item}
                </button>
              ))}
              {formatosDisponiveis.length === 1 && (
                <span className="pl-1 text-[11.5px] text-ink-faint">
                  gerada só neste formato
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const nome = `${safeFilename(draft.headline)}-${format.replace(":", "x")}.png`;
                try {
                  if (versaoVisivel.generated_path && generatedUrl) return await downloadUrl(generatedUrl, nome);
                  if (canvasRef.current) return await downloadNode(canvasRef.current, nome);
                } catch {
                  toast.error("Não conseguimos exportar o PNG.");
                }
              }}
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              Baixar PNG
            </Button>
          </div>

          <div className="flex flex-col gap-4">
            <Field label="Headline" htmlFor="headline">
              <Textarea
                id="headline"
                rows={2}
                value={draft.headline}
                onChange={(event) => patch({ headline: event.target.value })}
              />
            </Field>
            <Field label="Subheadline" htmlFor="sub" optional>
              <Input id="sub" value={draft.subheadline} onChange={(event) => patch({ subheadline: event.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="CTA" htmlFor="cta">
                <Input id="cta" value={draft.cta} onChange={(event) => patch({ cta: event.target.value })} />
              </Field>
              <Field label="Preço" htmlFor="preco" optional>
                <Input
                  id="preco"
                  value={draft.price}
                  onChange={(event) => patch({ price: event.target.value })}
                  placeholder="R$ 89,90"
                />
              </Field>
            </div>

            {!versaoVisivel.generated_path && (
              <Field label={`Contraste do fundo · ${Math.round(draft.scrim * 100)}%`} htmlFor="scrim">
                <input
                  id="scrim"
                  type="range"
                  min={0}
                  max={85}
                  value={Math.round(draft.scrim * 100)}
                  onChange={(event) => patch({ scrim: Number(event.target.value) / 100 })}
                  className="w-full accent-[#B4623A]"
                />
              </Field>
            )}

            <div className="flex flex-col gap-1">
              <MonoLabel>Prompt visual</MonoLabel>
              <p className="text-[12.5px] leading-relaxed text-ink-muted">{asset.visual_prompt || "—"}</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="quiet" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            loading={actions.updateComposition.isPending || actions.regenerate.isPending}
            onClick={() => {
              /*
               * Texto desenhado não se edita no lugar: o modelo desenhou as
               * letras dentro da imagem. Salvar o texto novo e mandar
               * redesenhar é o que faz a edição valer — e é por isso que ela
               * custa um crédito.
               */
              actions.updateComposition.mutate(
                { id: versaoVisivel.id, composition: draft, templateKey: draft.template_key },
                {
                  onSuccess: () => {
                    if (!versaoVisivel.generated_path) {
                      toast.success("Composição salva");
                      onOpenChange(false);
                      return;
                    }
                    actions.regenerate.mutate(
                      { assetId: versaoVisivel.id, mode: "peca" },
                      { onSuccess: () => onOpenChange(false) },
                    );
                  },
                },
              );
            }}
          >
            {versaoVisivel.generated_path
              ? `Salvar e redesenhar ${format} · 1 crédito`
              : "Salvar composição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
