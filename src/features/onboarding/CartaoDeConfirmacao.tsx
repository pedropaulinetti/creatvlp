import * as React from "react";
import { Check, ImagePlus, Plus, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Hint, Input, MonoLabel, Textarea } from "@/components/ui/field";
import { InlineError, Notice } from "@/components/ui/states";
import { FotoDoProduto } from "@/components/FotoDoProduto";
import { prettyUrl } from "@/lib/url";
import { formatarPreco } from "./SequenciaDeLeitura";
import type { Draft, Leitura } from "./tipos";

/**
 * A única tela entre a leitura e o app.
 *
 * Tudo o que foi encontrado aparece de uma vez, editável no lugar. Não há
 * etapas: quem quiser só olhar e confirmar leva alguns segundos, quem quiser
 * corrigir corrige aqui mesmo. O resto se completa depois em Minha Marca.
 */
export function CartaoDeConfirmacao({
  draft,
  leitura,
  aplicar,
  aoConfirmar,
  aoEnviarLogo,
  aoEnviarFotoDeProduto,
  aoRecomecar,
  salvando,
  erro,
}: {
  draft: Draft;
  leitura: Leitura;
  aplicar: (valores: Partial<Draft>) => void;
  aoConfirmar: () => void;
  aoEnviarLogo: (arquivo: File) => Promise<void>;
  aoEnviarFotoDeProduto: (indice: number, arquivo: File) => Promise<void>;
  aoRecomecar: () => void;
  salvando: boolean;
  erro: string;
}) {
  const podeConcluir = draft.company.trim().length >= 2 && draft.products.some((p) => p.name.trim());

  return (
    <div className="flex w-full max-w-[680px] flex-col gap-6">
      <header className="surgir flex flex-col gap-2.5">
        <MonoLabel className="text-accent">
          {draft.website ? `Lido de ${prettyUrl(draft.website)}` : "Da nossa conversa"}
        </MonoLabel>
        <h1 className="text-[30px] font-normal leading-[1.1] tracking-[-0.03em] text-ink md:text-[38px]">
          Encontramos sua marca.
        </h1>
        <Hint>
          Confira e ajuste o que quiser. Nada foi gravado ainda — e o que faltar você
          completa depois em Minha Marca.
        </Hint>
      </header>

      {!leitura.funcaoAtual && (
        <Notice tone="warning">
          A leitura veio da versão anterior da função publicada — por isso paleta, logo e
          imagens não batem com o que este app espera. Publique as Edge Functions
          (<code className="font-mono text-[12px]">npm run functions:deploy</code>) e leia o
          site de novo.
        </Notice>
      )}

      {!leitura.textoOk && (
        <Notice tone="warning">
          A descrição e o tom de voz não puderam ser interpretados. Confira esses dois campos
          com atenção.
        </Notice>
      )}

      <section
        className="surgir flex flex-col gap-5 rounded-[14px] border border-line-strong bg-card p-5"
        style={{ animationDelay: "70ms" }}
      >
        <Identidade draft={draft} leitura={leitura} aplicar={aplicar} aoEnviarLogo={aoEnviarLogo} />

        <div className="h-px bg-line-soft" />

        <Field label="Nome da marca" htmlFor="rev-company">
          <Input
            id="rev-company"
            value={draft.company}
            onChange={(evento) => aplicar({ company: evento.target.value })}
            placeholder="Minas Estate Coffee"
          />
        </Field>

        <Field label="O que a marca faz" htmlFor="rev-description" optional>
          <Textarea
            id="rev-description"
            rows={2}
            className="min-h-[64px]"
            value={draft.description}
            onChange={(evento) => aplicar({ description: evento.target.value })}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Segmento" htmlFor="rev-segment" optional>
            <Input
              id="rev-segment"
              value={draft.segment}
              onChange={(evento) => aplicar({ segment: evento.target.value })}
            />
          </Field>
          <Field label="Tom de voz" htmlFor="rev-tone" optional>
            <Input
              id="rev-tone"
              value={draft.voiceTone}
              onChange={(evento) => aplicar({ voiceTone: evento.target.value })}
              placeholder="Próximo e informativo"
            />
          </Field>
        </div>

        <Produtos draft={draft} leitura={leitura} aplicar={aplicar} aoEnviarFoto={aoEnviarFotoDeProduto} />

        <Field label="Quem compra de você" htmlFor="rev-audience" optional>
          <Textarea
            id="rev-audience"
            rows={2}
            className="min-h-[64px]"
            value={draft.audience}
            onChange={(evento) => aplicar({ audience: evento.target.value })}
            placeholder="Quem é a pessoa, o que ela busca e o que a faz comprar."
          />
        </Field>
      </section>

      <InlineError>{erro}</InlineError>

      <div className="surgir flex flex-wrap items-center gap-3" style={{ animationDelay: "140ms" }}>
        <Button variant="quiet" onClick={aoRecomecar} disabled={salvando}>
          Ler outro endereço
        </Button>
        <Button className="ml-auto" size="lg" onClick={aoConfirmar} loading={salvando} disabled={!podeConcluir}>
          {!salvando && <Sparkles className="h-4 w-4" aria-hidden />}
          É isso, criar marca
        </Button>
      </div>

      {!podeConcluir && (
        <Hint className="text-right">
          Falta o nome da marca e ao menos um produto.
        </Hint>
      )}
    </div>
  );
}

/** Paleta, tipografia e logo: a parte que a pessoa confirma olhando, não lendo. */
function Identidade({
  draft,
  leitura,
  aplicar,
  aoEnviarLogo,
}: {
  draft: Draft;
  leitura: Leitura;
  aplicar: (valores: Partial<Draft>) => void;
  aoEnviarLogo: (arquivo: File) => Promise<void>;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <MonoLabel>
          Paleta · {draft.colors.length} {draft.colors.length === 1 ? "cor" : "cores"}
          {leitura.folhas > 0 && ` de ${leitura.folhas} ${leitura.folhas === 1 ? "folha" : "folhas"} de estilo`}
        </MonoLabel>

        {draft.colors.length ? (
          <div className="flex flex-wrap gap-1.5">
            {draft.colors.map((cor, index) => (
              <button
                key={cor.hex + cor.role}
                type="button"
                aria-label={`Remover ${cor.hex} (${cor.role})`}
                onClick={() => aplicar({ colors: draft.colors.filter((_, i) => i !== index) })}
                className="cair group relative flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-1.5 pr-2.5 transition-colors hover:border-danger"
                style={{ animationDelay: `${Math.min(index, 9) * 45}ms` }}
              >
                <span
                  aria-hidden
                  className="h-4 w-4 rounded-full border border-line"
                  style={{ background: cor.hex }}
                />
                <span className="font-mono text-[11px] uppercase text-ink-2">{cor.hex}</span>
                <span className="text-[10.5px] text-ink-faint group-hover:hidden">{cor.role}</span>
                <X aria-hidden className="hidden h-3 w-3 text-danger group-hover:block" />
              </button>
            ))}
          </div>
        ) : (
          <Hint>Nenhuma cor foi encontrada. Você define a paleta em Minha Marca.</Hint>
        )}
      </div>

      {leitura.imagens.length > 0 && (
        <div className="flex flex-col gap-2">
          <MonoLabel>
            Referências visuais · {draft.referencePaths.length || leitura.imagens.length}
          </MonoLabel>
          <div className="flex flex-wrap gap-2">
            {leitura.imagens.slice(0, 4).map((url, index) => (
              <img
                key={url}
                src={url}
                alt=""
                loading="lazy"
                className="surgir h-16 w-16 rounded-[8px] border border-line object-cover"
                style={{ animationDelay: `${index * 60}ms` }}
                onError={(evento) => {
                  evento.currentTarget.style.display = "none";
                }}
              />
            ))}
          </div>
          <Hint>Guardadas com a marca. Servem de partida visual para as primeiras peças.</Hint>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {(draft.typography.headline || draft.typography.body) && (
          <div className="flex flex-col gap-0.5">
            <MonoLabel>Tipografia</MonoLabel>
            <span className="text-[15px] text-ink" style={{ fontFamily: `"${draft.typography.headline}", var(--font-sans)` }}>
              {draft.typography.headline || draft.typography.body}
              {draft.typography.body && draft.typography.body !== draft.typography.headline && (
                <span className="text-ink-muted"> · {draft.typography.body}</span>
              )}
            </span>
          </div>
        )}

        {draft.logoPath || leitura.logoUrl ? (
          <div className="flex flex-col gap-1">
            <MonoLabel>Logo</MonoLabel>
            <Logo url={leitura.logoUrl} guardada={Boolean(draft.logoPath)} />
          </div>
        ) : (
          <EnvioDeLogo aoEnviar={aoEnviarLogo} />
        )}
      </div>
    </div>
  );
}

/** O logo à vista, a partir do endereço de origem. */
function Logo({ url, guardada }: { url: string; guardada: boolean }) {
  const [quebrou, setQuebrou] = React.useState(false);

  if (!url || quebrou) {
    return (
      <span className="flex items-center gap-1.5 text-[13px] text-ink-2">
        <Check className="h-3.5 w-3.5 text-positive" aria-hidden />
        Logo importada
      </span>
    );
  }

  return (
    <span className="hatch flex h-14 min-w-14 items-center justify-center rounded-[8px] border border-line px-2">
      <img
        src={url}
        alt={guardada ? "Logo importada do site" : "Logo encontrada no site"}
        className="max-h-10 w-auto max-w-[150px] object-contain"
        onError={() => setQuebrou(true)}
      />
    </span>
  );
}

/**
 * Sem site — ou com site sem logo próprio — não há de onde importar a marca.
 * Este é o único envio de arquivo que sobrou no onboarding: o resto se faz
 * depois, com calma, em Minha Marca.
 */
function EnvioDeLogo({ aoEnviar }: { aoEnviar: (arquivo: File) => Promise<void> }) {
  const [enviando, setEnviando] = React.useState(false);

  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[13px] text-ink-muted transition-colors hover:text-ink">
      <ImagePlus className="h-3.5 w-3.5" aria-hidden />
      {enviando ? "Enviando logo…" : "Enviar logo"}
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        className="sr-only"
        disabled={enviando}
        onChange={async (evento) => {
          const arquivo = evento.target.files?.[0];
          evento.target.value = "";
          if (!arquivo) return;
          setEnviando(true);
          await aoEnviar(arquivo);
          setEnviando(false);
        }}
      />
    </label>
  );
}

function Produtos({
  draft,
  leitura,
  aplicar,
  aoEnviarFoto,
}: {
  draft: Draft;
  leitura: Leitura;
  aplicar: (valores: Partial<Draft>) => void;
  aoEnviarFoto: (indice: number, arquivo: File) => Promise<void>;
}) {
  return (
    <Field
      label={`Produtos${draft.products.length ? ` · ${draft.products.length}` : ""}`}
      hint={
        // A foto é o que a peça mostra: sem dizer que dá para enviar, ninguém
        // descobre o quadrado vazio do lado do nome.
        leitura.loja
          ? "Importados da sua loja. Clique no quadrado para pôr ou trocar a foto."
          : "Adicione ao menos um produto ou serviço. O quadrado ao lado leva a foto."
      }
    >
      <div className="flex flex-col gap-1.5">
        {draft.products.map((produto, index) => (
          <div
            key={index}
            className="surgir flex items-center gap-2"
            style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
          >
            <FotoDoProduto
              nome={produto.name}
              imagePath={produto.imagePath}
              imageUrl={produto.imageUrl}
              aoEnviar={(arquivo) => aoEnviarFoto(index, arquivo)}
            />
            <Input
              value={produto.name}
              aria-label={`Produto ${index + 1}`}
              onChange={(evento) => {
                const proximos = [...draft.products];
                proximos[index] = { ...produto, name: evento.target.value };
                aplicar({ products: proximos });
              }}
            />
            {typeof produto.priceCents === "number" && (
              <span className="shrink-0 font-mono text-[11.5px] text-ink-muted">
                {formatarPreco(produto.priceCents, produto.currency || leitura.moeda)}
              </span>
            )}
            <Button
              type="button"
              variant="quiet"
              size="iconLg"
              aria-label={`Remover ${produto.name || `produto ${index + 1}`}`}
              onClick={() => aplicar({ products: draft.products.filter((_, i) => i !== index) })}
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
          onClick={() => aplicar({ products: [...draft.products, { name: "", description: "" }] })}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Adicionar produto
        </Button>
      </div>
    </Field>
  );
}
