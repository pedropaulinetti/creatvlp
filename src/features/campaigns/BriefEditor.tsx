import * as React from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea, MonoLabel } from "@/components/ui/field";
import { Select, Checkbox, TagInput } from "@/components/ui/controls";
import { briefSchema, type Brief, type BriefInput, CHANNELS, FORMATS, FORMAT_LABEL } from "@/lib/schemas";
import { cn } from "@/lib/utils";

const ROWS: { key: keyof Brief; label: string }[] = [
  { key: "campaign_name", label: "Nome" },
  { key: "objective", label: "Objetivo" },
  { key: "product", label: "Produto" },
  { key: "audience", label: "Público" },
  { key: "offer", label: "Oferta" },
  { key: "channel", label: "Canal" },
  { key: "formats", label: "Formatos" },
  { key: "quantity", label: "Quantidade" },
  { key: "voice_tone", label: "Tom de voz" },
  { key: "restrictions", label: "Restrições" },
  { key: "occasion", label: "Data ou ocasião" },
  { key: "cta", label: "CTA" },
  { key: "primary_metric", label: "Métrica principal" },
];

function display(value: Brief[keyof Brief]): string {
  if (Array.isArray(value)) return value.length ? value.join(" · ") : "—";
  if (typeof value === "number") return String(value);
  return value?.toString().trim() || "—";
}

/**
 * O briefing é sempre mostrado para confirmação — nada é gerado antes disso.
 * Tudo é editável na hora.
 */
export function BriefEditor({
  brief,
  onConfirm,
  confirming = false,
  confirmLabel = "Confirmar e gerar caminhos",
  readOnly = false,
}: {
  brief: Brief;
  onConfirm?: (brief: Brief) => void;
  confirming?: boolean;
  confirmLabel?: string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = React.useState(false);

  const form = useForm<BriefInput, unknown, Brief>({
    resolver: zodResolver(briefSchema),
    defaultValues: brief,
  });

  React.useEffect(() => {
    form.reset(brief);
  }, [brief, form]);

  if (!editing) {
    return (
      <div className="flex flex-col gap-4 rounded-[14px] border border-line-strong bg-card p-5">
        <div className="flex items-center gap-3">
          <MonoLabel className="text-accent">Briefing</MonoLabel>
          {!readOnly && (
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="ml-auto">
              <Pencil className="h-3.5 w-3.5" aria-hidden />
              Editar
            </Button>
          )}
        </div>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2">
          {ROWS.map((row) => (
            <div key={row.key} className="flex flex-col gap-0.5 border-b border-line-soft py-2.5 last:border-0">
              <dt className="label-mono">{row.label}</dt>
              <dd className="text-[13.5px] leading-relaxed text-ink">{display(brief[row.key])}</dd>
            </div>
          ))}
        </dl>

        {onConfirm && !readOnly && (
          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center">
            <p className="text-[12.5px] leading-relaxed text-ink-muted sm:flex-1">
              Ao confirmar, geramos {" "}
              <strong className="text-ink">3 a 5 caminhos criativos com copies</strong> — ainda sem imagens.
              Nenhum crédito de imagem é usado nesta etapa.
            </p>
            <Button onClick={() => onConfirm(brief)} loading={confirming} className="shrink-0">
              {!confirming && <Check className="h-4 w-4" aria-hidden />}
              {confirmLabel}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={form.handleSubmit((values) => {
        setEditing(false);
        onConfirm?.(values);
      })}
      className="flex flex-col gap-4 rounded-[14px] border border-accent/40 bg-card p-5"
    >
      <MonoLabel className="text-accent">Editando o briefing</MonoLabel>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nome da campanha" error={form.formState.errors.campaign_name?.message} className="sm:col-span-2">
          <Input {...form.register("campaign_name")} />
        </Field>

        <Field label="Objetivo" error={form.formState.errors.objective?.message}>
          <Input {...form.register("objective")} />
        </Field>

        <Field label="Produto" error={form.formState.errors.product?.message}>
          <Input {...form.register("product")} />
        </Field>

        <Field label="Público" error={form.formState.errors.audience?.message}>
          <Input {...form.register("audience")} />
        </Field>

        <Field label="Oferta" optional>
          <Input {...form.register("offer")} />
        </Field>

        <Field label="Canal" error={form.formState.errors.channel?.message}>
          <Controller
            control={form.control}
            name="channel"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                options={CHANNELS.map((channel) => ({ value: channel, label: channel }))}
                aria-label="Canal"
              />
            )}
          />
        </Field>

        <Field label="Quantidade de peças" error={form.formState.errors.quantity?.message}>
          <Input type="number" min={1} max={30} {...form.register("quantity", { valueAsNumber: true })} />
        </Field>

        <Field label="Formatos" error={form.formState.errors.formats?.message} className="sm:col-span-2">
          <Controller
            control={form.control}
            name="formats"
            render={({ field }) => (
              <div className="flex flex-wrap gap-4">
                {FORMATS.map((format) => (
                  <label key={format} className="flex cursor-pointer items-center gap-2">
                    <Checkbox
                      checked={(field.value ?? []).includes(format)}
                      onCheckedChange={(checked) =>
                        field.onChange(
                          checked
                            ? [...(field.value ?? []), format]
                            : (field.value ?? []).filter((item) => item !== format),
                        )
                      }
                      aria-label={FORMAT_LABEL[format]}
                    />
                    <span className="text-[13.5px] text-ink">{FORMAT_LABEL[format]}</span>
                  </label>
                ))}
              </div>
            )}
          />
        </Field>

        <Field label="Tom de voz" optional>
          <Input {...form.register("voice_tone")} />
        </Field>

        <Field label="Data ou ocasião" optional>
          <Input {...form.register("occasion")} />
        </Field>

        <Field label="CTA" error={form.formState.errors.cta?.message}>
          <Input {...form.register("cta")} />
        </Field>

        <Field label="Métrica principal" error={form.formState.errors.primary_metric?.message}>
          <Input {...form.register("primary_metric")} />
        </Field>

        <Field label="Restrições" optional className="sm:col-span-2">
          <Controller
            control={form.control}
            name="restrictions"
            render={({ field }) => (
              <TagInput value={field.value ?? []} onChange={field.onChange} placeholder="Não citar concorrentes" />
            )}
          />
        </Field>
      </div>

      <div className={cn("flex items-center justify-end gap-2 pt-1")}>
        <Button type="button" variant="quiet" onClick={() => { form.reset(brief); setEditing(false); }}>
          Cancelar
        </Button>
        <Button type="submit" loading={confirming}>
          <Check className="h-4 w-4" aria-hidden />
          Salvar e confirmar
        </Button>
      </div>
    </form>
  );
}

export function BriefSummary({ brief }: { brief: Brief }) {
  return <BriefEditor brief={brief} readOnly />;
}

export { Textarea };
