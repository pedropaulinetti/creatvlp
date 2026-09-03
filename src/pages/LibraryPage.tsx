import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Check, Download, FolderPlus, Grid2x2, Heart, List, Search, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Divider } from "@/components/ui/surface";
import { Input, MonoLabel } from "@/components/ui/field";
import { Select, Checkbox } from "@/components/ui/controls";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/overlays";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { AssetCard } from "@/features/creatives/AssetCard";
import { CreativeCanvas, emptyComposition, type Composition } from "@/features/creatives/CreativeCanvas";
import { useAssetActions } from "@/features/creatives/mutations";
import { useSignedUrls, useBrandLogoUrl } from "@/features/creatives/useAssetUrls";
import { ASSET_STATUS } from "@/features/creatives/status";
import { exportZip, renderToBlob, safeFilename } from "@/features/creatives/export";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { requireSupabase, supabase } from "@/lib/supabase";
import { FORMATS, type Format } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/database.types";

type Asset = Database["public"]["Tables"]["creative_assets"]["Row"] & {
  variants?: Database["public"]["Tables"]["creative_variants"]["Row"][];
  campaign?: { name: string } | null;
  direction?: { name: string } | null;
};

const PAGE_SIZE = 24;

const STATUS_OPTIONS = [
  { value: "todos", label: "Todos os status" },
  ...Object.entries(ASSET_STATUS).map(([value, item]) => ({ value, label: item.label })),
];

const FORMAT_OPTIONS = [
  { value: "todos", label: "Todos os formatos" },
  ...FORMATS.map((format) => ({ value: format, label: format })),
];

const PERIOD_OPTIONS = [
  { value: "todos", label: "Qualquer data" },
  { value: "7", label: "Últimos 7 dias" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
];

export default function LibraryPage() {
  const { workspaceId, brandId } = useWorkspace();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const actions = useAssetActions();
  const logo = useBrandLogoUrl();

  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [status, setStatus] = React.useState(searchParams.get("status") ?? "todos");
  const [format, setFormat] = React.useState("todos");
  const [period, setPeriod] = React.useState("todos");
  const [campaign, setCampaign] = React.useState("todas");
  const [folder, setFolder] = React.useState<string | null>(null);
  const [favorites, setFavorites] = React.useState(false);
  const [trash, setTrash] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [newFolder, setNewFolder] = React.useState(false);
  const [folderName, setFolderName] = React.useState("");
  const [exporting, setExporting] = React.useState(false);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  React.useEffect(() => {
    if (status !== "todos") setSearchParams({ status }, { replace: true });
    else setSearchParams({}, { replace: true });
  }, [status, setSearchParams]);

  const folders = useQuery({
    queryKey: ["folders", workspaceId],
    enabled: Boolean(workspaceId && supabase),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("folders")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const campaigns = useQuery({
    queryKey: ["library-campaigns", workspaceId, brandId],
    enabled: Boolean(workspaceId && brandId && supabase),
    queryFn: async () => {
      const { data, error } = await supabase!
        .from("campaigns")
        .select("id, name")
        .eq("workspace_id", workspaceId!)
        .eq("brand_id", brandId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data ?? [];
    },
  });

  const query = useInfiniteQuery({
    queryKey: ["library", workspaceId, brandId, status, format, period, campaign, folder, favorites, trash, debounced],
    enabled: Boolean(workspaceId && brandId && supabase),
    initialPageParam: 0,
    getNextPageParam: (last: Asset[], pages) => (last.length === PAGE_SIZE ? pages.length : undefined),
    queryFn: async ({ pageParam }) => {
      const from = (pageParam as number) * PAGE_SIZE;
      let request = supabase!
        .from("creative_assets")
        .select("*, variants:creative_variants(*), campaign:campaigns(name), direction:creative_directions(name)")
        .eq("workspace_id", workspaceId!)
        .eq("brand_id", brandId!)
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      request = trash ? request.not("deleted_at", "is", null) : request.is("deleted_at", null);
      if (status !== "todos") request = request.eq("status", status as Asset["status"]);
      if (format !== "todos") request = request.eq("format", format);
      if (campaign !== "todas") request = request.eq("campaign_id", campaign);
      if (folder) request = request.eq("folder_id", folder);
      if (favorites) request = request.eq("is_favorite", true);
      if (period !== "todos") {
        const since = new Date(Date.now() - Number(period) * 86_400_000).toISOString();
        request = request.gte("created_at", since);
      }

      const { data, error } = await request;
      if (error) throw error;

      const rows = (data ?? []) as unknown as Asset[];
      if (!debounced.trim()) return rows;

      // A busca varre headline e nome do caminho, que vivem em JSON e relação.
      const term = debounced.trim().toLowerCase();
      return rows.filter((asset) => {
        const headline = (asset.composition as { headline?: string })?.headline ?? "";
        return (
          headline.toLowerCase().includes(term) ||
          asset.campaign?.name?.toLowerCase().includes(term) ||
          asset.direction?.name?.toLowerCase().includes(term)
        );
      });
    },
  });

  const assets = React.useMemo(() => (query.data?.pages ?? []).flat(), [query.data]);
  const urls = useSignedUrls("creative-assets", assets.map((asset) => asset.base_path));

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      const client = requireSupabase();
      const { error } = await client.from("folders").insert({ workspace_id: workspaceId!, name: name.trim() });
      if (error) throw error;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["folders"] });
      setNewFolder(false);
      setFolderName("");
      toast.success("Pasta criada");
    },
    onError: () => toast.error("Já existe uma pasta com esse nome."),
  });

  const selectedAssets = assets.filter((asset) => selected.includes(asset.id));

  async function exportSelection() {
    if (!selectedAssets.length) return;
    setExporting(true);
    try {
      const items: { name: string; blob: Blob; composition: unknown }[] = [];

      // Renderiza cada peça fora da tela, no tamanho real.
      for (const asset of selectedAssets) {
        const composition = {
          ...emptyComposition(asset.format as Format),
          ...(asset.composition as object),
        } as Composition;
        const blob = await renderOffscreen({
          imageUrl: urls.data?.get(asset.base_path ?? "") ?? null,
          logoUrl: logo.data ?? null,
          composition,
          format: asset.format as Format,
        });
        items.push({
          name: safeFilename(composition.headline || asset.id.slice(0, 8)),
          blob,
          composition,
        });
      }

      await exportZip(items, `creatvos-${new Date().toISOString().slice(0, 10)}`);
      toast.success(`${items.length} peças exportadas`);
    } catch {
      toast.error("Não conseguimos montar o ZIP. Tente com menos peças.");
    } finally {
      setExporting(false);
    }
  }

  const activeFilters =
    status !== "todos" || format !== "todos" || period !== "todos" || campaign !== "todas" || favorites || folder;

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-5 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <MonoLabel className="text-accent">Biblioteca</MonoLabel>
          <h1 className="text-[26px] font-normal tracking-[-0.025em] text-ink md:text-[32px]">
            Tudo que já foi produzido
          </h1>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant={view === "grid" ? "outline" : "quiet"}
            size="icon"
            aria-label="Ver em grade"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <Grid2x2 className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant={view === "list" ? "outline" : "quiet"}
            size="icon"
            aria-label="Ver em lista"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      {/* Pastas */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant={folder === null && !trash ? "outline" : "quiet"}
          size="sm"
          onClick={() => {
            setFolder(null);
            setTrash(false);
          }}
        >
          Todas
        </Button>
        {(folders.data ?? []).map((item) => (
          <Button
            key={item.id}
            variant={folder === item.id ? "outline" : "quiet"}
            size="sm"
            onClick={() => {
              setFolder(item.id);
              setTrash(false);
            }}
          >
            {item.name}
          </Button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => setNewFolder(true)}>
          <FolderPlus className="h-3.5 w-3.5" aria-hidden />
          Nova pasta
        </Button>
        <Button
          variant={trash ? "outline" : "ghost"}
          size="sm"
          className="ml-auto"
          onClick={() => {
            setTrash((value) => !value);
            setFolder(null);
          }}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Lixeira
        </Button>
      </div>

      {/* Filtros */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <div className="relative lg:col-span-2">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar headline, campanha ou ângulo"
            className="pl-9"
            aria-label="Buscar na biblioteca"
          />
        </div>
        <Select value={status} onValueChange={setStatus} options={STATUS_OPTIONS} aria-label="Status" />
        <Select value={format} onValueChange={setFormat} options={FORMAT_OPTIONS} aria-label="Formato" />
        <Select value={period} onValueChange={setPeriod} options={PERIOD_OPTIONS} aria-label="Período" />
        <Select
          value={campaign}
          onValueChange={setCampaign}
          options={[
            { value: "todas", label: "Todas as campanhas" },
            ...(campaigns.data ?? []).map((item) => ({ value: item.id, label: item.name })),
          ]}
          aria-label="Campanha"
          className="lg:col-span-2"
        />
        <Button
          variant={favorites ? "outline" : "quiet"}
          onClick={() => setFavorites((value) => !value)}
          aria-pressed={favorites}
        >
          <Heart className={cn("h-3.5 w-3.5", favorites && "fill-accent text-accent")} aria-hidden />
          Favoritos
        </Button>
        {activeFilters && (
          <Button
            variant="ghost"
            onClick={() => {
              setStatus("todos");
              setFormat("todos");
              setPeriod("todos");
              setCampaign("todas");
              setFolder(null);
              setFavorites(false);
              setSearch("");
            }}
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Barra de seleção em lote */}
      {selected.length > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-[12px] border border-accent/30 bg-accent-soft px-4 py-2.5">
          <span className="text-[13px] text-accent-ink">
            {selected.length} {selected.length === 1 ? "selecionado" : "selecionados"}
          </span>
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => actions.setStatus.mutate({ ids: selected, status: "aprovado" })}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Aprovar
            </Button>
            <Button size="sm" variant="outline" onClick={exportSelection} loading={exporting}>
              {!exporting && <Download className="h-3.5 w-3.5" aria-hidden />}
              Exportar ZIP
            </Button>
            {(folders.data ?? []).length > 0 && (
              <Select
                value=""
                onValueChange={(value) =>
                  actions.moveToFolder.mutate({ ids: selected, folderId: value === "raiz" ? null : value })
                }
                options={[
                  { value: "raiz", label: "Sem pasta" },
                  ...(folders.data ?? []).map((item) => ({ value: item.id, label: item.name })),
                ]}
                placeholder="Mover para"
                className="h-[30px] w-[150px] text-[12.5px]"
                aria-label="Mover para pasta"
              />
            )}
            {trash ? (
              <Button size="sm" variant="outline" onClick={() => actions.restore.mutate(selected)}>
                Restaurar
              </Button>
            ) : (
              <Button size="sm" variant="quiet" onClick={() => actions.softDelete.mutate(selected)}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Excluir
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Limpar
            </Button>
          </div>
        </div>
      )}

      {query.isLoading ? (
        <LoadingBlock label="Carregando a biblioteca" />
      ) : query.error ? (
        <ErrorState description="Não conseguimos carregar os criativos." onRetry={() => void query.refetch()} />
      ) : assets.length === 0 ? (
        <EmptyState
          title={trash ? "A lixeira está vazia" : activeFilters || debounced ? "Nada com esses filtros" : "Nenhum criativo ainda"}
          description={
            trash
              ? "Criativos excluídos ficam aqui e podem ser restaurados."
              : activeFilters || debounced
                ? "Ajuste os filtros para ver outras peças."
                : "Assim que uma campanha gerar imagens, elas aparecem aqui."
          }
        />
      ) : (
        <>
          {view === "grid" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  compact
                  imageUrl={urls.data?.get(asset.base_path ?? "") ?? null}
                  logoUrl={logo.data ?? null}
                  selected={selected.includes(asset.id)}
                  onSelectedChange={(value) =>
                    setSelected((current) =>
                      value ? [...current, asset.id] : current.filter((id) => id !== asset.id),
                    )
                  }
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col">
              {assets.map((asset) => {
                const assetStatus = ASSET_STATUS[asset.status];
                return (
                  <div
                    key={asset.id}
                    className="flex items-center gap-4 border-b border-line-soft py-3 transition-colors hover:bg-sunken"
                  >
                    <Checkbox
                      checked={selected.includes(asset.id)}
                      onCheckedChange={(value) =>
                        setSelected((current) =>
                          value ? [...current, asset.id] : current.filter((id) => id !== asset.id),
                        )
                      }
                      aria-label="Selecionar criativo"
                    />
                    <CreativeCanvas
                      imageUrl={urls.data?.get(asset.base_path ?? "") ?? null}
                      logoUrl={logo.data ?? null}
                      composition={
                        { ...emptyComposition(asset.format as Format), ...(asset.composition as object) } as Composition
                      }
                      format={asset.format as Format}
                      displayWidth={48}
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[13.5px] text-ink">
                        {(asset.composition as { headline?: string })?.headline || "Sem headline"}
                      </span>
                      <span className="truncate text-[12px] text-ink-muted">
                        {asset.campaign?.name ?? "Sem campanha"}
                        {asset.direction?.name && ` · ${asset.direction.name}`}
                      </span>
                    </div>
                    <Badge tone={assetStatus.tone}>{assetStatus.label}</Badge>
                    <span className="hidden font-mono text-[11px] text-ink-faint sm:inline">{asset.format}</span>
                    <span className="hidden font-mono text-[11px] text-ink-faint md:inline">
                      {new Date(asset.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {query.hasNextPage && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" onClick={() => void query.fetchNextPage()} loading={query.isFetchingNextPage}>
                Carregar mais
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={newFolder} onOpenChange={setNewFolder}>
        <DialogContent title="Nova pasta" description="Organize os criativos por campanha, produto ou tema.">
          <Input
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder="Coleção Essencial"
            aria-label="Nome da pasta"
            autoFocus
          />
          <DialogFooter>
            <Button variant="quiet" onClick={() => setNewFolder(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => createFolder.mutate(folderName)}
              disabled={folderName.trim().length < 2}
              loading={createFolder.isPending}
            >
              Criar pasta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Divider className="mt-4" />
      <p className="text-center text-[12px] text-ink-faint">
        Os arquivos são privados. O acesso usa links temporários que expiram em uma hora.
      </p>
    </div>
  );
}

/** Renderiza uma peça fora da tela para exportar sem depender do que está visível. */
async function renderOffscreen(params: {
  imageUrl: string | null;
  logoUrl: string | null;
  composition: Composition;
  format: Format;
}): Promise<Blob> {
  const { createRoot } = await import("react-dom/client");
  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-10000px";
  host.style.top = "0";
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    const node = await new Promise<HTMLElement>((resolve, reject) => {
      const ref = (element: HTMLDivElement | null) => {
        if (element) setTimeout(() => resolve(element), 120);
      };
      root.render(
        <CreativeCanvas
          ref={ref}
          imageUrl={params.imageUrl}
          logoUrl={params.logoUrl}
          composition={params.composition}
          format={params.format}
          displayWidth={540}
        />,
      );
      setTimeout(() => reject(new Error("Tempo esgotado ao renderizar")), 8000);
    });
    return await renderToBlob(node);
  } finally {
    root.unmount();
    host.remove();
  }
}
