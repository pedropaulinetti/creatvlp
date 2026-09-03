import * as React from "react";
import { toast } from "sonner";
import {
  Check, Download, Heart, MoreHorizontal, Pencil, RefreshCw, Star, Trash2, X,
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
import { downloadNode, safeFilename } from "@/features/creatives/export";
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

const TEMPLATES = [
  { key: "produto-destaque", name: "Produto em destaque" },
  { key: "beneficio-principal", name: "Benefício principal" },
  { key: "prova-social", name: "Prova social" },
  { key: "comparacao", name: "Comparação" },
  { key: "oferta", name: "Oferta" },
  { key: "editorial", name: "Editorial" },
  { key: "story-cta", name: "Story com CTA" },
];

export function AssetCard({
  asset,
  imageUrl,
  logoUrl,
  selected,
  onSelectedChange,
  compact = false,
}: {
  asset: Asset;
  imageUrl: string | null;
  logoUrl: string | null;
  selected?: boolean;
  onSelectedChange?: (value: boolean) => void;
  compact?: boolean;
}) {
  const actions = useAssetActions();
  const [open, setOpen] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
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

  const availableFormats = React.useMemo(() => {
    const set = new Set<Format>([asset.format as Format]);
    for (const variant of asset.variants ?? []) set.add(variant.format as Format);
    return FORMATS.filter((item) => set.has(item));
  }, [asset.format, asset.variants]);

  async function download() {
    if (!canvasRef.current) return;
    try {
      await downloadNode(canvasRef.current, `${safeFilename(asset.id.slice(0, 8))}-${format.replace(":", "x")}.png`);
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
          <CreativeCanvas
            ref={canvasRef}
            imageUrl={imageUrl}
            logoUrl={logoUrl}
            composition={compositionFor(format)}
            format={format}
            displayWidth={compact ? 200 : 260}
            className="mx-auto"
          />
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

        <div className="flex items-center gap-1.5">
          {asset.status !== "aprovado" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => actions.setStatus.mutate({ ids: [asset.id], status: "aprovado" })}
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
                Editar composição
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
              <DropdownMenuLabel>Regenerar</DropdownMenuLabel>
              <DropdownMenuItem
                onSelect={() => actions.regenerate.mutate({ assetId: asset.id, mode: "copy" })}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Só a copy · sem crédito
              </DropdownMenuItem>
              {IMAGE_QUALITIES.map((level) => (
                <DropdownMenuItem
                  key={level}
                  onSelect={() =>
                    actions.regenerate.mutate({ assetId: asset.id, mode: "imagem", quality: level })
                  }
                >
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                  Imagem {IMAGE_QUALITY[level].label.toLowerCase()} · 1 crédito ·{" "}
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
                actions.setStatus.mutate({ ids: [asset.id], status: "rejeitado", reason: reason.trim() });
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
  open,
  onOpenChange,
  imageUrl,
  logoUrl,
  format,
  onFormatChange,
  composition,
}: {
  asset: Asset;
  open: boolean;
  onOpenChange: (value: boolean) => void;
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
        description="Texto, posição e contraste são do CreatvOS — a imagem é só o fundo."
      >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[minmax(0,260px)_1fr]">
          <div className="flex flex-col gap-3">
            <CreativeCanvas
              ref={canvasRef}
              imageUrl={imageUrl}
              logoUrl={logoUrl}
              composition={draft}
              format={format}
              displayWidth={240}
            />
            <div className="flex flex-wrap items-center gap-1">
              {FORMATS.map((item) => (
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
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                if (!canvasRef.current) return;
                try {
                  await downloadNode(canvasRef.current, `${safeFilename(draft.headline)}-${format.replace(":", "x")}.png`);
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

            <Field label="Template" htmlFor="template">
              <div className="flex flex-wrap gap-1.5">
                {TEMPLATES.map((template) => (
                  <button
                    key={template.key}
                    type="button"
                    onClick={() => patch({ template_key: template.key })}
                    aria-pressed={draft.template_key === template.key}
                    className={cn(
                      "h-8 rounded-full border px-3 text-[12px] transition-colors",
                      draft.template_key === template.key
                        ? "border-accent bg-accent-soft text-accent-ink"
                        : "border-line text-ink-2 hover:border-accent",
                    )}
                  >
                    {template.name}
                  </button>
                ))}
              </div>
            </Field>

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
            loading={actions.updateComposition.isPending}
            onClick={() => {
              actions.updateComposition.mutate(
                { id: asset.id, composition: draft, templateKey: draft.template_key },
                {
                  onSuccess: () => {
                    toast.success("Composição salva");
                    onOpenChange(false);
                  },
                },
              );
            }}
          >
            Salvar composição
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
