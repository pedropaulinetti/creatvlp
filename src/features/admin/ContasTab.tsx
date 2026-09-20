/*
 * Contas — a mesa de decisão sobre pessoas.
 *
 * A aba que esta substitui abria com oito contadores (usuários, workspaces,
 * campanhas, peças) que não pediam nada de ninguém, e listava workspaces por
 * nome, sem dizer quem era o dono nem se ele ainda estava por perto.
 *
 * Aqui a ordem é a informação: quem precisa de você primeiro. E a régua de
 * crédito é o único elemento gráfico da tela, repetido linha a linha, para a
 * página ser varrida de relance em vez de lida.
 */
import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MoreHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Divider, Panel } from "@/components/ui/surface";
import { Field, Input, MonoLabel, Hint } from "@/components/ui/field";
import { Select } from "@/components/ui/controls";
import {
  Dialog, DialogContent, DialogFooter,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/overlays";
import { EmptyState, ErrorState, LoadingBlock } from "@/components/ui/states";
import { requireSupabase, supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

type Conta = {
  user_id: string;
  full_name: string;
  email: string;
  platform_role: "user" | "admin";
  access_status: "ativo" | "bloqueado";
  blocked_reason: string;
  joined_at: string;
  workspace_id: string | null;
  workspace_name: string | null;
  plan: "beta" | "growth" | "studio";
  images_limit: number;
  images_used: number;
  campaigns_used: number;
  bonus_images: number;
  period_end: string | null;
  last_activity: string | null;
  assets_total: number;
  assets_approved: number;
  assets_rejected: number;
  failed_jobs_7d: number;
};

/* ------------------------------------------------------------------ estado */

type Sinal = "bloqueado" | "falhando" | "nao_ativou" | "no_limite" | "esfriou" | "ativa";

const SINAL: Record<Sinal, { rotulo: string; tom: "danger" | "warning" | "muted" | "positive"; peso: number }> = {
  falhando:   { rotulo: "falhando",    tom: "danger",   peso: 0 },
  nao_ativou: { rotulo: "não ativou",  tom: "warning",  peso: 1 },
  no_limite:  { rotulo: "no limite",   tom: "warning",  peso: 2 },
  esfriou:    { rotulo: "esfriou",     tom: "muted",    peso: 3 },
  ativa:      { rotulo: "ativa",       tom: "positive", peso: 4 },
  bloqueado:  { rotulo: "bloqueada",   tom: "danger",   peso: 5 },
};

const DIA = 86_400_000;

/**
 * Um estado por conta, na ordem em que os problemas importam. Bloqueada vem por
 * último de propósito: já foi decidida, não disputa atenção com o resto.
 */
export function sinalDaConta(conta: Conta, agora = Date.now()): Sinal {
  if (conta.access_status === "bloqueado") return "bloqueado";
  if (conta.failed_jobs_7d >= 2) return "falhando";

  const desdeEntrada = agora - new Date(conta.joined_at).getTime();
  if (!conta.last_activity) return desdeEntrada > 3 * DIA ? "nao_ativou" : "ativa";

  const teto = conta.images_limit + conta.bonus_images;
  if (teto > 0 && conta.images_used / teto >= 0.8) return "no_limite";
  if (agora - new Date(conta.last_activity).getTime() > 7 * DIA) return "esfriou";
  return "ativa";
}

function haQuantoTempo(iso: string | null): string {
  if (!iso) return "nunca";
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / DIA);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  return `há ${Math.floor(dias / 30)} ${Math.floor(dias / 30) === 1 ? "mês" : "meses"}`;
}

/* -------------------------------------------------------------------- tela */

export function ContasTab({ onError }: { onError: (message: string) => void }) {
  const queryClient = useQueryClient();
  const [busca, setBusca] = React.useState("");
  const [ordem, setOrdem] = React.useState("atencao");
  const [ajustando, setAjustando] = React.useState<Conta | null>(null);
  const [bloqueando, setBloqueando] = React.useState<Conta | null>(null);
  const [ficha, setFicha] = React.useState<Conta | null>(null);

  const query = useQuery({
    queryKey: ["admin-contas"],
    enabled: Boolean(supabase),
    queryFn: async () => {
      const { data, error } = await supabase!.rpc("admin_accounts");
      if (error) throw error;
      return (data ?? []) as Conta[];
    },
  });

  const recarregar = () => queryClient.invalidateQueries({ queryKey: ["admin-contas"] });

  const acesso = useMutation({
    mutationFn: async ({ conta, bloquear, motivo }: { conta: Conta; bloquear: boolean; motivo: string }) => {
      const { error } = await requireSupabase().rpc("set_account_access", {
        p_user: conta.user_id,
        p_status: bloquear ? "bloqueado" : "ativo",
        p_reason: motivo,
      });
      if (error) throw error;
    },
    onSuccess: async (_d, vars) => {
      await recarregar();
      setBloqueando(null);
      toast.success(vars.bloquear ? "Conta bloqueada" : "Conta reativada");
    },
    onError: (e: { message?: string }) => onError(e?.message ?? "Não conseguimos mudar o acesso desta conta."),
  });

  const contas = React.useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = (query.data ?? []).filter(
      (c) => !termo || `${c.full_name} ${c.email} ${c.workspace_name ?? ""}`.toLowerCase().includes(termo),
    );
    return [...lista].sort((a, b) => {
      if (ordem === "recentes") return +new Date(b.joined_at) - +new Date(a.joined_at);
      if (ordem === "consumo") return b.images_used - a.images_used;
      const pa = SINAL[sinalDaConta(a)].peso;
      const pb = SINAL[sinalDaConta(b)].peso;
      return pa !== pb ? pa - pb : +new Date(a.last_activity ?? 0) - +new Date(b.last_activity ?? 0);
    });
  }, [query.data, busca, ordem]);

  if (query.isLoading) return <LoadingBlock label="Carregando contas" />;
  if (query.error) return <ErrorState description="Falha ao carregar as contas." onRetry={() => void query.refetch()} />;

  const todas = query.data ?? [];
  const ativasNaSemana = todas.filter(
    (c) => c.last_activity && Date.now() - new Date(c.last_activity).getTime() < 7 * DIA,
  ).length;
  const julgadas = todas.reduce((s, c) => s + c.assets_approved + c.assets_rejected, 0);
  const aprovadas = todas.reduce((s, c) => s + c.assets_approved, 0);
  const falhas = todas.reduce((s, c) => s + c.failed_jobs_7d, 0);

  return (
    <div className="flex flex-col gap-5">
      {/* Saúde da beta em quatro números, sem caixa. Números em mono porque são
          leitura de instrumento, não prosa. */}
      <div className="flex flex-wrap items-stretch gap-x-8 gap-y-4">
        <Numero valor={String(todas.length)} rotulo="contas" />
        <Numero valor={`${ativasNaSemana}`} rotulo="ativas na semana" sub={`de ${todas.length}`} />
        <Numero
          valor={julgadas ? `${Math.round((aprovadas / julgadas) * 100)}%` : "—"}
          rotulo="taxa de aprovação"
          sub={julgadas ? `${julgadas} peças julgadas` : "nada julgado ainda"}
        />
        <Numero valor={String(falhas)} rotulo="falhas em 7 dias" alerta={falhas > 0} />
      </div>

      <Divider />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" aria-hidden />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, e-mail ou workspace"
            aria-label="Buscar conta"
            className="pl-9"
          />
        </div>
        <Select
          value={ordem}
          onValueChange={setOrdem}
          aria-label="Ordenar"
          options={[
            { value: "atencao", label: "Precisa de atenção" },
            { value: "recentes", label: "Entraram por último" },
            { value: "consumo", label: "Maior consumo" },
          ]}
        />
      </div>

      {!contas.length ? (
        <EmptyState title="Nenhuma conta" description="Ninguém corresponde a esta busca." />
      ) : (
        <Panel className="overflow-hidden">
          <div className="hidden grid-cols-[minmax(0,1fr)_92px_112px_150px_104px_120px_36px] items-center gap-4 border-b border-line px-5 py-2.5 lg:grid">
            <MonoLabel>Pessoa</MonoLabel>
            <MonoLabel>Estado</MonoLabel>
            <MonoLabel>Plano</MonoLabel>
            <MonoLabel>Crédito do ciclo</MonoLabel>
            <MonoLabel>Atividade</MonoLabel>
            <MonoLabel>Peças</MonoLabel>
            <span />
          </div>

          {contas.map((conta) => (
            <Linha
              key={conta.user_id}
              conta={conta}
              onFicha={() => setFicha(conta)}
              onAjustar={() => setAjustando(conta)}
              onAcesso={() =>
                conta.access_status === "bloqueado"
                  ? acesso.mutate({ conta, bloquear: false, motivo: "" })
                  : setBloqueando(conta)
              }
            />
          ))}
        </Panel>
      )}

      <AjustarDialog conta={ajustando} onClose={() => setAjustando(null)} onSaved={recarregar} onError={onError} />
      <BloquearDialog
        conta={bloqueando}
        pendente={acesso.isPending}
        onClose={() => setBloqueando(null)}
        onConfirm={(motivo) => bloqueando && acesso.mutate({ conta: bloqueando, bloquear: true, motivo })}
      />
      <FichaDialog conta={ficha} onClose={() => setFicha(null)} />
    </div>
  );
}

function Numero({ valor, rotulo, sub, alerta }: { valor: string; rotulo: string; sub?: string; alerta?: boolean }) {
  return (
    <div className="flex min-w-[112px] flex-col gap-1">
      <span className={cn("font-mono text-[26px] leading-none tracking-[-0.02em]", alerta ? "text-danger" : "text-ink")}>
        {valor}
      </span>
      <MonoLabel>{rotulo}</MonoLabel>
      {sub && <span className="text-[11.5px] text-ink-faint">{sub}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------- linha */

function Linha({
  conta, onFicha, onAjustar, onAcesso,
}: { conta: Conta; onFicha: () => void; onAjustar: () => void; onAcesso: () => void }) {
  const sinal = sinalDaConta(conta);
  const bloqueada = conta.access_status === "bloqueado";
  const teto = conta.images_limit + conta.bonus_images;
  const fracao = teto > 0 ? Math.min(1, conta.images_used / teto) : 0;
  const julgadas = conta.assets_approved + conta.assets_rejected;

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-3 border-b border-line-soft px-5 py-3.5 transition-colors last:border-b-0",
        "lg:grid-cols-[minmax(0,1fr)_92px_112px_150px_104px_120px_36px] lg:items-center lg:gap-4",
        bloqueada ? "bg-sunken/60" : "hover:bg-sunken/50",
      )}
    >
      <button type="button" onClick={onFicha} className="flex min-w-0 flex-col items-start text-left">
        <span className={cn("truncate text-[15px] leading-tight", bloqueada ? "text-ink-muted line-through" : "text-ink")}>
          {conta.full_name || "(sem nome)"}
        </span>
        <span className="truncate font-mono text-[11.5px] text-ink-faint">{conta.email}</span>
      </button>

      <div>
        <Badge tone={SINAL[sinal].tom}>{SINAL[sinal].rotulo}</Badge>
      </div>

      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-ink-2">{conta.plan}</span>
        <span className="font-mono text-[11px] text-ink-faint">entrou {haQuantoTempo(conta.joined_at)}</span>
      </div>

      {/* A régua do ciclo: o único gráfico da tela, e o que a torna varrível. */}
      <div className="flex flex-col gap-1.5">
        <div className="h-[3px] w-full overflow-hidden rounded-full bg-line">
          <div
            className={cn("h-full rounded-full transition-[width]", fracao >= 0.8 ? "bg-accent" : "bg-ink")}
            style={{ width: `${Math.round(fracao * 100)}%` }}
          />
        </div>
        <span className="font-mono text-[11.5px] text-ink-2">
          {conta.images_used}/{teto || "—"}
          {conta.bonus_images > 0 && <span className="text-ink-faint"> (+{conta.bonus_images})</span>}
        </span>
      </div>

      <span className="font-mono text-[12px] text-ink-2">{haQuantoTempo(conta.last_activity)}</span>

      <div className="flex flex-col gap-0.5">
        <span className="font-mono text-[12.5px] text-ink-2">{conta.assets_total} peças</span>
        <span className="font-mono text-[11px] text-ink-faint">
          {julgadas ? `${Math.round((conta.assets_approved / julgadas) * 100)}% aprovadas` : "nada julgado"}
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="quiet" size="icon" aria-label={`Ações de ${conta.full_name || conta.email}`}>
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onFicha}>Ver ficha</DropdownMenuItem>
          <DropdownMenuItem onSelect={onAjustar}>Ajustar plano e crédito</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem tone={bloqueada ? undefined : "danger"} onSelect={onAcesso}>
            {bloqueada ? "Reativar conta" : "Bloquear conta"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ----------------------------------------------------------------- diálogos */

function AjustarDialog({
  conta, onClose, onSaved, onError,
}: { conta: Conta | null; onClose: () => void; onSaved: () => void; onError: (m: string) => void }) {
  const [plano, setPlano] = React.useState("beta");
  const [bonus, setBonus] = React.useState("0");

  React.useEffect(() => {
    if (conta) {
      setPlano(conta.plan);
      setBonus(String(conta.bonus_images));
    }
  }, [conta]);

  const salvar = useMutation({
    mutationFn: async () => {
      if (!conta?.workspace_id) throw new Error("Esta conta não tem workspace.");
      const client = requireSupabase();
      const { error } = await client
        .from("workspaces")
        .update({ plan: plano as "beta" | "growth" | "studio" })
        .eq("id", conta.workspace_id);
      if (error) throw error;

      /*
       * Grava o bônus sempre, inclusive zero. A versão anterior só gravava
       * quando o número era maior que zero — então um crédito extra concedido
       * por engano não tinha como ser retirado.
       */
      const { error: quotaError } = await client
        .from("usage_quotas")
        .update({ bonus_images: Math.max(0, Number(bonus) || 0) })
        .eq("workspace_id", conta.workspace_id);
      if (quotaError) throw quotaError;
    },
    onSuccess: () => {
      onSaved();
      onClose();
      toast.success("Conta atualizada");
    },
    onError: (e: { message?: string }) => onError(e?.message ?? "Não conseguimos atualizar esta conta."),
  });

  return (
    <Dialog open={Boolean(conta)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title="Ajustar plano e crédito" description={conta?.email}>
        <div className="flex flex-col gap-4">
          <Field label="Plano">
            <Select
              value={plano}
              onValueChange={setPlano}
              aria-label="Plano"
              options={[
                { value: "beta", label: "Beta" },
                { value: "growth", label: "Growth" },
                { value: "studio", label: "Studio" },
              ]}
            />
          </Field>
          <Field label="Crédito extra neste ciclo">
            <Input type="number" min={0} value={bonus} onChange={(e) => setBonus(e.target.value)} />
          </Field>
          <Hint>Somado ao limite do plano até o ciclo virar. Zero remove o extra.</Hint>
        </div>
        <DialogFooter>
          <Button variant="quiet" onClick={onClose}>Cancelar</Button>
          <Button loading={salvar.isPending} onClick={() => salvar.mutate()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BloquearDialog({
  conta, pendente, onClose, onConfirm,
}: { conta: Conta | null; pendente: boolean; onClose: () => void; onConfirm: (motivo: string) => void }) {
  const [motivo, setMotivo] = React.useState("");
  React.useEffect(() => setMotivo(""), [conta]);

  return (
    <Dialog open={Boolean(conta)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        title="Bloquear conta"
        description="A pessoa perde o acesso na hora. Nada do que ela criou é apagado."
      >
        <Field label="Motivo" hint="Fica no registro de auditoria e aparece para ela na tela de bloqueio.">
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Uso fora do combinado na beta"
            autoFocus
          />
        </Field>
        <DialogFooter>
          <Button variant="quiet" onClick={onClose}>Cancelar</Button>
          <Button
            variant="danger"
            loading={pendente}
            disabled={motivo.trim().length < 3}
            onClick={() => onConfirm(motivo)}
          >
            Bloquear
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FichaDialog({ conta, onClose }: { conta: Conta | null; onClose: () => void }) {
  const feedback = useQuery({
    queryKey: ["admin-feedback", conta?.workspace_id],
    enabled: Boolean(conta?.workspace_id && supabase),
    queryFn: async () => {
      const { data, error } = await supabase!.rpc("admin_account_feedback", {
        p_workspace: conta!.workspace_id!,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <Dialog open={Boolean(conta)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent title={conta?.full_name || conta?.email || "Conta"} description={conta?.email}>
        {conta && (
          <div className="flex flex-col gap-5">
            {conta.access_status === "bloqueado" && (
              <div className="rounded-[10px] border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-[13px] text-ink">
                Bloqueada{conta.blocked_reason ? ` — ${conta.blocked_reason}` : ""}
              </div>
            )}

            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Dado rotulo="Workspace" valor={conta.workspace_name ?? "—"} />
              <Dado rotulo="Plano" valor={conta.plan} />
              <Dado rotulo="Campanhas" valor={String(conta.campaigns_used)} />
              <Dado rotulo="Falhas em 7 dias" valor={String(conta.failed_jobs_7d)} />
              <Dado rotulo="Peças" valor={String(conta.assets_total)} />
              <Dado rotulo="Aprovadas" valor={String(conta.assets_approved)} />
              <Dado rotulo="Rejeitadas" valor={String(conta.assets_rejected)} />
              <Dado rotulo="Última atividade" valor={haQuantoTempo(conta.last_activity)} />
            </dl>

            <Divider />

            {/* O que a pessoa escreveu ao rejeitar uma peça. Está gravado desde
                sempre e nunca teve onde ser lido. */}
            <div className="flex flex-col gap-2.5">
              <MonoLabel>O que ela rejeitou, e por quê</MonoLabel>
              {feedback.isLoading ? (
                <LoadingBlock label="Carregando" />
              ) : !feedback.data?.length ? (
                <Hint>Nenhuma peça rejeitada com motivo escrito.</Hint>
              ) : (
                <div className="flex max-h-[260px] flex-col overflow-y-auto">
                  {feedback.data.map((item, i) => (
                    <div key={i} className="flex flex-col gap-1 border-b border-line-soft py-2.5 last:border-b-0">
                      <p className="text-[13.5px] leading-snug text-ink">{item.motivo}</p>
                      <span className="font-mono text-[11px] text-ink-faint">
                        {item.formato} · {new Date(item.criado_em).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Dado({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="label-mono">{rotulo}</dt>
      <dd className="font-mono text-[14px] text-ink">{valor}</dd>
    </div>
  );
}
