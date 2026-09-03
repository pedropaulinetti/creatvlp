import * as React from "react";
import { Check, ShoppingBag } from "lucide-react";
import { Hint } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { prettyUrl } from "@/lib/url";
import { ETAPAS, type EstadoEtapa, type Leitura } from "./tipos";

/**
 * A leitura acontecendo à vista.
 *
 * Cada etapa mostra o que encontrou no instante em que encontra: as cores caem
 * uma a uma, a amostra de texto passa a usar a tipografia do site, as imagens e
 * os produtos entram em cascata. Não é enfeite — é a diferença entre uma espera
 * de vinte segundos parecer trabalho ou parecer travamento.
 */
export function SequenciaDeLeitura({ leitura }: { leitura: Leitura }) {
  const feitas = ETAPAS.filter((item) => leitura.estados[item.chave] === "feito").length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="h-[5px] w-full overflow-hidden rounded-full bg-line-soft">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(4, (feitas / ETAPAS.length) * 100)}%` }}
          />
        </div>
        {leitura.url && (
          <Hint>
            {prettyUrl(leitura.url)} · {feitas} de {ETAPAS.length}
            {feitas > 0 && !leitura.aoVivo && " · sem leitura ao vivo nesta conexão"}
          </Hint>
        )}
      </div>

      <ol className="flex flex-col gap-1">
        {ETAPAS.map((item) => (
          <Passo key={item.chave} rotulo={item.rotulo} estado={leitura.estados[item.chave]}>
            <Achado etapa={item.chave} leitura={leitura} />
          </Passo>
        ))}
      </ol>
    </div>
  );
}

/**
 * Uma etapa e o que ela achou.
 *
 * O trilho à esquerda é o que dá peso ao movimento: ele acende em terracota na
 * etapa em curso, com uma luz que o atravessa, e fica sólido quando termina.
 */
function Passo({
  rotulo,
  estado,
  children,
}: {
  rotulo: string;
  estado: EstadoEtapa;
  children: React.ReactNode;
}) {
  const lendo = estado === "lendo";
  const feito = estado === "feito";

  return (
    <li className={cn("flex gap-4 transition-opacity duration-300", !lendo && !feito && "opacity-35")}>
      <span
        aria-hidden
        className={cn(
          "mt-1 w-[3px] shrink-0 self-stretch rounded-full transition-colors duration-300",
          lendo ? "varrendo bg-accent" : feito ? "bg-positive/45" : "bg-line-contrast",
        )}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2 py-1.5">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "text-[14.5px] transition-colors duration-300",
              lendo ? "font-medium text-accent-ink" : feito ? "text-ink" : "text-ink-muted",
            )}
          >
            {rotulo}
          </span>
          {feito && <Check className="h-3.5 w-3.5 text-positive" aria-hidden />}
        </span>
        {children}
      </div>
    </li>
  );
}

/** O que cada etapa tem a mostrar. Vazio enquanto ela não terminou. */
function Achado({ etapa, leitura }: { etapa: (typeof ETAPAS)[number]["chave"]; leitura: Leitura }) {
  if (leitura.estados[etapa] !== "feito") return null;

  switch (etapa) {
    case "pagina":
      return leitura.titulo ? <Legenda>{leitura.titulo}</Legenda> : null;

    case "navegacao":
      return leitura.paginas.length ? (
        <ul className="flex flex-col gap-0.5">
          {leitura.paginas.map((endereco, index) => (
            <li
              key={endereco}
              className="surgir truncate text-[12.5px] text-ink-muted"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {prettyUrl(endereco)}
            </li>
          ))}
        </ul>
      ) : (
        <Legenda>só a home</Legenda>
      );

    case "estilos":
      return (
        <Legenda>
          {leitura.folhas} {leitura.folhas === 1 ? "folha lida" : "folhas lidas"}
        </Legenda>
      );

    case "paleta":
      return leitura.cores.length ? <Paleta cores={leitura.cores} /> : <Legenda>nenhuma cor declarada</Legenda>;

    case "tipografia":
      return <Tipografia fontes={leitura.fontes} />;

    case "logo":
      return <LogoAchado url={leitura.logoUrl} guardado={Boolean(leitura.logoPath)} />;

    case "referencias":
      return leitura.imagens.length ? (
        <Imagens urls={leitura.imagens} guardadas={leitura.referencias} />
      ) : (
        <Legenda>nenhuma imagem aproveitável</Legenda>
      );

    case "catalogo":
      return leitura.produtos.length ? (
        <Catalogo produtos={leitura.produtos} moeda={leitura.moeda} loja={leitura.loja} />
      ) : (
        <Legenda>nenhum catálogo publicado</Legenda>
      );

    case "texto":
      return <Legenda>{leitura.textoOk ? "descrição e tom interpretados" : "não foi possível interpretar"}</Legenda>;

    default:
      return null;
  }
}

const Legenda = ({ children }: { children: React.ReactNode }) => (
  <span className="surgir text-[12.5px] text-ink-muted">{children}</span>
);

/** As cores caem na ordem em que foram encontradas. */
function Paleta({ cores }: { cores: Leitura["cores"] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {cores.map((cor, index) => (
        <span
          key={cor.hex + cor.role}
          title={`${cor.hex} · ${cor.role}`}
          className="cair flex flex-col items-center gap-1"
          style={{ animationDelay: `${Math.min(index, 9) * 60}ms` }}
        >
          <span
            className="h-9 w-9 rounded-full border border-line shadow-raise"
            style={{ background: cor.hex }}
          />
          <span className="font-mono text-[9.5px] uppercase tracking-tight text-ink-faint">
            {cor.hex.slice(1)}
          </span>
        </span>
      ))}
    </div>
  );
}

/**
 * A amostra passa a usar a tipografia do site.
 *
 * A fonte é carregada do Google Fonts só para esta prévia. Se a família não
 * existir por lá, o link não resolve e a amostra fica na fonte do app — que é
 * exatamente o comportamento desejado, sem nenhum tratamento extra.
 */
function Tipografia({ fontes }: { fontes: Leitura["fontes"] }) {
  useFonteRemota(fontes.headline);
  useFonteRemota(fontes.body);

  if (!fontes.headline && !fontes.body) return <Legenda>nenhuma família declarada</Legenda>;

  return (
    <div className="surgir flex flex-wrap items-baseline gap-x-3 gap-y-1">
      {fontes.headline && (
        <span
          className="text-[22px] leading-none text-ink"
          style={{ fontFamily: `"${fontes.headline}", var(--font-sans)` }}
        >
          {fontes.headline}
        </span>
      )}
      {fontes.body && fontes.body !== fontes.headline && (
        <span className="text-[13px] text-ink-muted" style={{ fontFamily: `"${fontes.body}", var(--font-sans)` }}>
          texto em {fontes.body}
        </span>
      )}
    </div>
  );
}

/**
 * O logo, à vista.
 *
 * Mostrado a partir do endereço de origem, que é o que chega primeiro — dizer
 * "logo importada" em texto não convence ninguém de que veio o logo certo.
 * O fundo quadriculado revela vetor com fundo transparente.
 */
function LogoAchado({ url, guardado }: { url: string; guardado: boolean }) {
  const [quebrou, setQuebrou] = React.useState(false);

  if (!url) return <Legenda>sem logo próprio</Legenda>;

  return (
    <div className="surgir flex items-center gap-3">
      {!quebrou && (
        <span className="hatch flex h-14 min-w-14 items-center justify-center rounded-[8px] border border-line px-2">
          <img
            src={url}
            alt="Logo encontrada no site"
            className="max-h-10 w-auto max-w-[140px] object-contain"
            onError={() => setQuebrou(true)}
          />
        </span>
      )}
      <Legenda>{guardado ? "guardada com a marca" : "encontrada no site"}</Legenda>
    </div>
  );
}

/** As imagens do site, mostradas da origem enquanto são guardadas no Storage. */
function Imagens({ urls, guardadas }: { urls: string[]; guardadas: number }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-2">
        {urls.slice(0, 4).map((url, index) => (
          <img
            key={url}
            src={url}
            alt=""
            loading="lazy"
            className="cair h-14 w-14 rounded-[8px] border border-line object-cover shadow-raise"
            style={{ animationDelay: `${index * 80}ms` }}
            onError={(evento) => {
              // Site que bloqueia hotlink não deve deixar um ícone quebrado.
              evento.currentTarget.style.display = "none";
            }}
          />
        ))}
      </div>
      <Legenda>
        {guardadas > 0
          ? `${guardadas} ${guardadas === 1 ? "guardada" : "guardadas"} como referência da marca`
          : `${urls.length} encontradas`}
      </Legenda>
    </div>
  );
}

function Catalogo({
  produtos,
  moeda,
  loja,
}: {
  produtos: Leitura["produtos"];
  moeda: string;
  loja: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="surgir flex items-center gap-1.5 text-[12.5px] text-ink-muted">
        {loja && <ShoppingBag className="h-3 w-3" aria-hidden />}
        {produtos.length} {produtos.length === 1 ? "produto importado" : "produtos importados"}
      </span>
      <ul className="flex flex-col gap-0.5">
        {produtos.slice(0, 4).map((produto, index) => (
          <li
            key={produto.name}
            className="surgir flex items-baseline gap-2 text-[13px] text-ink"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <span aria-hidden className="h-1 w-1 shrink-0 rounded-full bg-accent" />
            <span className="truncate">{produto.name}</span>
            {produto.price_cents !== null && (
              <span className="ml-auto shrink-0 font-mono text-[11.5px] text-ink-muted">
                {formatarPreco(produto.price_cents, moeda)}
              </span>
            )}
          </li>
        ))}
      </ul>
      {produtos.length > 4 && <Legenda>e mais {produtos.length - 4}</Legenda>}
    </div>
  );
}

export function formatarPreco(centavos: number, moeda: string): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: moeda || "BRL" }).format(
    centavos / 100,
  );
}

/** Carrega uma família do Google Fonts, uma única vez por nome. */
function useFonteRemota(familia: string) {
  React.useEffect(() => {
    const nome = familia.trim();
    if (!nome || /^(inter|dm mono)$/i.test(nome)) return;

    const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(nome).replace(/%20/g, "+")}&display=swap`;
    if (document.head.querySelector(`link[href="${CSS.escape(href)}"]`)) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.append(link);
  }, [familia]);
}
