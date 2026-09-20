import * as React from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Hint, MonoLabel } from "@/components/ui/field";
import { FotoDoProduto } from "@/components/FotoDoProduto";
import { cn } from "@/lib/utils";

/**
 * O que a peça precisa saber sobre um produto.
 *
 * Os mesmos campos no onboarding e em Minha Marca. Preço, link e destaques já
 * existiam no banco desde o começo — eram lidos do catálogo, gravados e nunca
 * mais mexidos, porque nenhuma tela os mostrava. Preço errado na leitura
 * ficava errado para sempre, e é preço que aparece desenhado na peça.
 */
export type ValoresDoProduto = {
  name: string;
  description: string;
  priceCents: number | null;
  currency: string;
  url: string;
  highlights: string[];
};

/** Centavos para o que se digita: "89,90" e "89.90" valem o mesmo. */
export function centavosDeTexto(texto: string): number | null {
  const limpo = texto.replace(/[^\d,.-]/g, "").replace(",", ".");
  if (!limpo) return null;
  const valor = Number.parseFloat(limpo);
  if (!Number.isFinite(valor) || valor < 0) return null;
  return Math.round(valor * 100);
}

export function textoDeCentavos(centavos: number | null | undefined): string {
  if (typeof centavos !== "number") return "";
  return (centavos / 100).toFixed(2).replace(".", ",");
}

const MOEDAS = ["BRL", "USD", "EUR"];

export function CamposDoProduto({
  valores,
  aoMudar,
  mostrarDescricao = true,
}: {
  valores: ValoresDoProduto;
  aoMudar: (valores: Partial<ValoresDoProduto>) => void;
  mostrarDescricao?: boolean;
}) {
  const [preco, setPreco] = React.useState(textoDeCentavos(valores.priceCents));

  // O preço vindo de fora (outra leitura, outro produto) reescreve o campo.
  React.useEffect(() => {
    setPreco(textoDeCentavos(valores.priceCents));
  }, [valores.priceCents]);

  return (
    <div className="flex flex-col gap-3">
      {mostrarDescricao && (
        <Field label="Descrição" htmlFor="prod-desc" optional>
          <Input
            id="prod-desc"
            value={valores.description}
            placeholder="O que resolve, para quem."
            onChange={(evento) => aoMudar({ description: evento.target.value })}
          />
        </Field>
      )}

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="Preço" htmlFor="prod-preco" optional>
          <Input
            id="prod-preco"
            inputMode="decimal"
            value={preco}
            placeholder="89,90"
            onChange={(evento) => setPreco(evento.target.value)}
            // Converter a cada tecla impediria apagar para redigitar.
            onBlur={() => aoMudar({ priceCents: centavosDeTexto(preco) })}
          />
        </Field>

        <Field label="Moeda" htmlFor="prod-moeda" optional>
          <select
            id="prod-moeda"
            value={valores.currency || "BRL"}
            onChange={(evento) => aoMudar({ currency: evento.target.value })}
            className="h-10 rounded-[10px] border border-line-strong bg-surface px-3 text-[14px] text-ink focus:border-accent focus:outline-none"
          >
            {MOEDAS.map((moeda) => (
              <option key={moeda} value={moeda}>
                {moeda}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Link na loja" htmlFor="prod-url" optional>
        <Input
          id="prod-url"
          type="url"
          value={valores.url}
          placeholder="https://"
          onChange={(evento) => aoMudar({ url: evento.target.value })}
        />
      </Field>

      <Destaques
        itens={valores.highlights}
        aoMudar={(highlights) => aoMudar({ highlights })}
      />
    </div>
  );
}

/**
 * Os destaques.
 *
 * São eles que viram a lista numerada da peça. Três é o teto de propósito: um
 * anúncio com seis linhas de benefício não é lido por ninguém, e o prompt já
 * corta no terceiro.
 */
function Destaques({
  itens,
  aoMudar,
}: {
  itens: string[];
  aoMudar: (itens: string[]) => void;
}) {
  const [novo, setNovo] = React.useState("");

  const acrescentar = () => {
    const limpo = novo.trim();
    if (!limpo || itens.length >= 3) return;
    aoMudar([...itens, limpo]);
    setNovo("");
  };

  return (
    <Field
      label="Destaques"
      hint="Até três frases curtas. São elas que a peça mostra como lista."
      optional
    >
      <div className="flex flex-col gap-2">
        {itens.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {itens.map((item, indice) => (
              <span
                key={item + indice}
                className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-3 pr-1.5 text-[12.5px] text-ink-2"
              >
                {item}
                <button
                  type="button"
                  aria-label={`Remover ${item}`}
                  onClick={() => aoMudar(itens.filter((_, i) => i !== indice))}
                  className="flex h-4 w-4 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-danger-soft hover:text-danger"
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
        )}

        {itens.length < 3 && (
          <div className="flex items-center gap-2">
            <Input
              value={novo}
              placeholder="94% recomendam"
              aria-label="Novo destaque"
              maxLength={70}
              onChange={(evento) => setNovo(evento.target.value)}
              onKeyDown={(evento) => {
                if (evento.key !== "Enter") return;
                evento.preventDefault();
                acrescentar();
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={acrescentar} disabled={!novo.trim()}>
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        )}
      </div>
    </Field>
  );
}

/**
 * A galeria de fotos do produto.
 *
 * A primeira é a principal: é ela que vai para a geração, porque o teto de
 * quatro referências do provedor obriga a escolher. As outras existem para
 * trocar de principal sem precisar subir de novo.
 */
export function GaleriaDoProduto({
  nome,
  caminhos,
  aoEnviar,
  aoRemover,
  aoTornarPrincipal,
  maximo = 5,
}: {
  nome: string;
  caminhos: string[];
  aoEnviar: (arquivo: File) => Promise<void>;
  aoRemover: (caminho: string) => void;
  aoTornarPrincipal: (caminho: string) => void;
  maximo?: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <MonoLabel>
        Fotos · {caminhos.length}
        {caminhos.length > 0 && " · a primeira é a que vai para a peça"}
      </MonoLabel>

      <div className="flex flex-wrap items-start gap-2">
        {caminhos.map((caminho, indice) => (
          <div key={caminho} className="group relative">
            <FotoDoProduto
              nome={nome}
              imagePath={caminho}
              aoEnviar={aoEnviar}
              className={cn(indice === 0 && "ring-2 ring-accent ring-offset-2 ring-offset-card")}
            />

            <button
              type="button"
              aria-label={`Remover foto ${indice + 1}`}
              onClick={() => aoRemover(caminho)}
              className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface text-ink-muted opacity-0 transition-opacity hover:text-danger focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="h-3 w-3" aria-hidden />
            </button>

            {indice > 0 && (
              <button
                type="button"
                onClick={() => aoTornarPrincipal(caminho)}
                className="absolute inset-x-0 bottom-0 rounded-b-[8px] bg-ink/70 py-0.5 text-[10px] text-surface opacity-0 transition-opacity group-hover:opacity-100"
              >
                usar esta
              </button>
            )}
          </div>
        ))}

        {caminhos.length < maximo && (
          <FotoDoProduto nome={nome} imagePath={null} aoEnviar={aoEnviar} />
        )}
      </div>

      {caminhos.length >= maximo && <Hint>Máximo de {maximo} fotos por produto.</Hint>}
    </div>
  );
}
