import * as React from "react";
import { Check, ChevronDown, Pencil, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Divider } from "@/components/ui/surface";
import { Checkbox } from "@/components/ui/controls";
import { Field, Input, Textarea, MonoLabel } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/overlays";
import { useDirectionActions } from "@/features/creatives/mutations";
import { cn } from "@/lib/utils";
import type { Database } from "@/lib/database.types";

type Copy = Database["public"]["Tables"]["creative_copies"]["Row"];
type Direction = Database["public"]["Tables"]["creative_directions"]["Row"] & { copies?: Copy[] };

const STATUS: Record<Direction["status"], { label: string; tone: "neutral" | "accent" | "positive" | "danger" }> = {
  proposta: { label: "Proposta", tone: "neutral" },
  selecionada: { label: "Selecionada", tone: "accent" },
  aprovada: { label: "Aprovada", tone: "positive" },
  rejeitada: { label: "Rejeitada", tone: "danger" },
};

/** A "mesa de testes": problema → promessa → hook → mecanismo → prova → CTA. */
const BENCH: { key: keyof Direction; label: string }[] = [
  { key: "problem", label: "Problema" },
  { key: "promise", label: "Promessa" },
  { key: "hook", label: "Hook" },
  { key: "mechanism", label: "Mecanismo" },
  { key: "proof", label: "Prova" },
  { key: "objection", label: "Objeção" },
  { key: "cta", label: "CTA" },
];

export function DirectionCard({
  direction,
  selected,
  onSelectedChange,
  disabled = false,
}: {
  direction: Direction;
  selected: boolean;
  onSelectedChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const actions = useDirectionActions();
  const [expanded, setExpanded] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [editingCopy, setEditingCopy] = React.useState<Copy | null>(null);

  const status = STATUS[direction.status];
  const copies = direction.copies ?? [];
  const isRejected = direction.status === "rejeitada";

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-[14px] border bg-card p-4 transition-colors md:p-5",
        selected ? "border-accent" : "border-line",
        isRejected && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <Checkbox
            checked={selected}
            onCheckedChange={onSelectedChange}
            disabled={disabled || isRejected}
            aria-label={`Selecionar ${direction.name} para gerar imagem`}
          />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15.5px] font-medium text-ink">{direction.name}</h3>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="text-[13px] leading-relaxed text-ink-muted">{direction.hypothesis}</p>
        </div>

        <Button
          variant="quiet"
          size="icon"
          aria-label={expanded ? "Recolher detalhes" : "Ver detalhes"}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </Button>
      </div>

      {expanded && (
        <>
          <Divider />
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            {BENCH.map((row) => {
              const value = direction[row.key];
              if (!value) return null;
              return (
                <div key={String(row.key)} className="flex flex-col gap-0.5">
                  <dt className="label-mono">{row.label}</dt>
                  <dd className="text-[13px] leading-relaxed text-ink">{String(value)}</dd>
                </div>
              );
            })}
          </dl>

          {direction.rationale && (
            <p className="rounded-[10px] bg-sunken px-3.5 py-2.5 text-[12.5px] leading-relaxed text-ink-2">
              {direction.rationale}
            </p>
          )}

          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <MonoLabel>Copies</MonoLabel>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                loading={actions.moreCopies.isPending}
                onClick={() => actions.moreCopies.mutate(direction.id)}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Mais variações
              </Button>
            </div>
            {copies.map((copy) => (
              <div key={copy.id} className="flex items-start gap-3 rounded-[10px] border border-line-soft p-3">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
                  {String.fromCharCode(65 + copy.variant_index)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="text-[13.5px] font-medium leading-snug text-ink">{copy.headline}</p>
                  {copy.subheadline && <p className="text-[12.5px] text-ink-2">{copy.subheadline}</p>}
                  {copy.body && <p className="text-[12.5px] leading-relaxed text-ink-muted">{copy.body}</p>}
                  <span className="text-[12px] text-accent">{copy.cta}</span>
                </div>
                <Button
                  variant="quiet"
                  size="icon"
                  aria-label={`Editar copy ${String.fromCharCode(65 + copy.variant_index)}`}
                  onClick={() => setEditingCopy(copy)}
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1">
            <MonoLabel>Prompt visual</MonoLabel>
            <p className="text-[12.5px] leading-relaxed text-ink-muted">{direction.visual_prompt}</p>
          </div>
        </>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {direction.status !== "aprovada" && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => actions.setStatus.mutate({ id: direction.id, status: "aprovada" })}
          >
            <Check className="h-3.5 w-3.5" aria-hidden />
            Aprovar
          </Button>
        )}
        <Button size="sm" variant="quiet" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" aria-hidden />
          Editar
        </Button>
        {!isRejected && (
          <Button size="sm" variant="quiet" onClick={() => setRejecting(true)}>
            <X className="h-3.5 w-3.5" aria-hidden />
            Rejeitar
          </Button>
        )}
        {isRejected && (
          <Button
            size="sm"
            variant="quiet"
            onClick={() => actions.setStatus.mutate({ id: direction.id, status: "proposta" })}
          >
            Reabrir
          </Button>
        )}
      </div>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent wide title="Editar caminho criativo" description="Ajuste o ângulo antes de gerar as imagens.">
          <EditDirectionForm
            direction={direction}
            saving={actions.update.isPending}
            onSave={(values) => {
              actions.update.mutate({ id: direction.id, values }, { onSuccess: () => setEditing(false) });
            }}
            onCancel={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={rejecting} onOpenChange={setRejecting}>
        <DialogContent title="Rejeitar caminho" description="O motivo entra no aprendizado da marca.">
          <Field label="Por que este caminho não serve?" htmlFor="motivo-direcao">
            <Textarea
              id="motivo-direcao"
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="A promessa não combina com o posicionamento…"
            />
          </Field>
          <DialogFooter>
            <Button variant="quiet" onClick={() => setRejecting(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                actions.setStatus.mutate({ id: direction.id, status: "rejeitada", reason: reason.trim() });
                setRejecting(false);
                setReason("");
              }}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editingCopy)} onOpenChange={(value) => !value && setEditingCopy(null)}>
        <DialogContent title="Editar copy" description="O texto é aplicado na composição, não na imagem.">
          {editingCopy && (
            <EditCopyForm
              copy={editingCopy}
              saving={actions.updateCopy.isPending}
              onSave={(values) =>
                actions.updateCopy.mutate(
                  { id: editingCopy.id, values },
                  { onSuccess: () => setEditingCopy(null) },
                )
              }
              onCancel={() => setEditingCopy(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </article>
  );
}

function EditDirectionForm({
  direction,
  onSave,
  onCancel,
  saving,
}: {
  direction: Direction;
  onSave: (values: Record<string, string>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [values, setValues] = React.useState({
    name: direction.name,
    hook: direction.hook,
    promise: direction.promise,
    mechanism: direction.mechanism,
    proof: direction.proof,
    objection: direction.objection,
    cta: direction.cta,
    visual_prompt: direction.visual_prompt,
  });

  const patch = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(values);
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Nome" htmlFor="dir-name">
        <Input id="dir-name" value={values.name} onChange={(event) => patch("name", event.target.value)} />
      </Field>
      <Field label="Hook" htmlFor="dir-hook">
        <Textarea id="dir-hook" rows={2} value={values.hook} onChange={(event) => patch("hook", event.target.value)} />
      </Field>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Promessa" htmlFor="dir-promise">
          <Input id="dir-promise" value={values.promise} onChange={(event) => patch("promise", event.target.value)} />
        </Field>
        <Field label="Mecanismo" htmlFor="dir-mechanism">
          <Input id="dir-mechanism" value={values.mechanism} onChange={(event) => patch("mechanism", event.target.value)} />
        </Field>
        <Field label="Prova" htmlFor="dir-proof" optional>
          <Input id="dir-proof" value={values.proof} onChange={(event) => patch("proof", event.target.value)} />
        </Field>
        <Field label="Objeção" htmlFor="dir-objection" optional>
          <Input id="dir-objection" value={values.objection} onChange={(event) => patch("objection", event.target.value)} />
        </Field>
        <Field label="CTA" htmlFor="dir-cta">
          <Input id="dir-cta" value={values.cta} onChange={(event) => patch("cta", event.target.value)} />
        </Field>
      </div>
      <Field
        label="Prompt visual"
        htmlFor="dir-prompt"
        hint="Descreva só a cena. Headline, logo e CTA são aplicados pelo CreatvOS depois."
      >
        <Textarea
          id="dir-prompt"
          rows={3}
          value={values.visual_prompt}
          onChange={(event) => patch("visual_prompt", event.target.value)}
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="quiet" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}

function EditCopyForm({
  copy,
  onSave,
  onCancel,
  saving,
}: {
  copy: Copy;
  onSave: (values: Record<string, string>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [values, setValues] = React.useState({
    headline: copy.headline,
    subheadline: copy.subheadline,
    body: copy.body,
    cta: copy.cta,
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSave(values);
      }}
      className="flex flex-col gap-4"
    >
      <Field label="Headline" htmlFor="copy-headline">
        <Textarea
          id="copy-headline"
          rows={2}
          value={values.headline}
          onChange={(event) => setValues({ ...values, headline: event.target.value })}
        />
      </Field>
      <Field label="Subheadline" htmlFor="copy-sub" optional>
        <Input
          id="copy-sub"
          value={values.subheadline}
          onChange={(event) => setValues({ ...values, subheadline: event.target.value })}
        />
      </Field>
      <Field label="Corpo" htmlFor="copy-body" optional>
        <Textarea
          id="copy-body"
          rows={3}
          value={values.body}
          onChange={(event) => setValues({ ...values, body: event.target.value })}
        />
      </Field>
      <Field label="CTA" htmlFor="copy-cta">
        <Input id="copy-cta" value={values.cta} onChange={(event) => setValues({ ...values, cta: event.target.value })} />
      </Field>
      <DialogFooter>
        <Button type="button" variant="quiet" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={saving}>
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}
