import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/surface";
import { Input, MonoLabel } from "@/components/ui/field";
import { Select } from "@/components/ui/controls";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { useCampaigns } from "@/features/campaigns/queries";
import { CAMPAIGN_STATUS } from "@/features/creatives/status";

const STATUS_OPTIONS = [
  { value: "todas", label: "Todos os status" },
  { value: "rascunho", label: "Rascunho" },
  { value: "briefing_confirmado", label: "Briefing confirmado" },
  { value: "gerando", label: "Gerando" },
  { value: "revisao", label: "Para revisar" },
  { value: "aprovada", label: "Aprovada" },
  { value: "arquivada", label: "Arquivada" },
];

export default function CampaignsPage() {
  const [status, setStatus] = React.useState("todas");
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const navigate = useNavigate();

  React.useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error, refetch } = useCampaigns({ status, search: debounced });

  return (
    <div className="mx-auto flex w-full max-w-[1080px] flex-col gap-6 px-5 py-6 md:px-8 md:py-8">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1.5">
          <MonoLabel className="text-accent">Campanhas</MonoLabel>
          <h1 className="text-[26px] font-normal tracking-[-0.025em] text-ink md:text-[32px]">
            Tudo que já foi para a mesa
          </h1>
        </div>
        <Button className="ml-auto" onClick={() => navigate("/app/campanhas/nova")}>
          <Plus className="h-4 w-4" aria-hidden />
          Criar campanha
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por nome"
            className="pl-9"
            aria-label="Buscar campanhas"
          />
        </div>
        <div className="sm:w-[220px]">
          <Select value={status} onValueChange={setStatus} options={STATUS_OPTIONS} aria-label="Filtrar por status" />
        </div>
      </div>

      {isLoading ? (
        <LoadingBlock label="Carregando campanhas" />
      ) : error ? (
        <ErrorState description="Não conseguimos listar as campanhas." onRetry={() => void refetch()} />
      ) : !data?.length ? (
        <EmptyState
          title={debounced || status !== "todas" ? "Nenhuma campanha com esse filtro" : "Nenhuma campanha ainda"}
          description={
            debounced || status !== "todas"
              ? "Ajuste a busca ou o status para ver outras campanhas."
              : "Comece uma conversa contando o que você quer testar. O briefing sai dela."
          }
          action={
            <Button size="sm" onClick={() => navigate("/app/campanhas/nova")}>
              Criar a primeira campanha
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col">
          <div className="hidden grid-cols-[1fr_140px_120px_110px] gap-4 border-b border-line px-4 pb-2 md:grid">
            <span className="label-mono">Campanha</span>
            <span className="label-mono">Status</span>
            <span className="label-mono">Peças</span>
            <span className="label-mono">Criada</span>
          </div>
          {data.map((campaign) => {
            const status = CAMPAIGN_STATUS[campaign.status];
            const assetCount =
              Array.isArray(campaign.assets) && campaign.assets.length > 0
                ? (campaign.assets[0] as { count: number }).count
                : 0;
            return (
              <Link
                key={campaign.id}
                to={`/app/campanhas/${campaign.id}`}
                className="grid grid-cols-1 gap-1.5 border-b border-line-soft px-4 py-3.5 transition-colors hover:bg-sunken md:grid-cols-[1fr_140px_120px_110px] md:items-center md:gap-4"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[14px] text-ink">{campaign.name}</span>
                  <span className="truncate text-[12.5px] text-ink-muted">
                    {campaign.objective || "Sem objetivo definido"}
                    {campaign.origin === "rotina" && " · rotina"}
                  </span>
                </div>
                <div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <span className="text-[13px] text-ink-2">
                  {assetCount} {assetCount === 1 ? "peça" : "peças"}
                </span>
                <span className="font-mono text-[11.5px] text-ink-faint">
                  {new Date(campaign.created_at).toLocaleDateString("pt-BR")}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
