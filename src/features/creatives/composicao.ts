import * as React from "react";
import { FORMAT_SIZE, type Format } from "@/lib/schemas";

/** O que o CreatvOS controla na peça — tudo menos a fotografia. */
export type Composition = {
  template_key: string;
  format: string;
  headline: string;
  subheadline: string;
  body: string;
  cta: string;
  price: string;
  /** Itens de lista: benefícios, sinais, números. Só alguns arquétipos usam. */
  bullets?: string[];
  /** Enquete: a pergunta é o anúncio — não há headline. */
  pergunta?: string;
  opcoes?: { texto: string; votos: number }[];
  /** Conversa: os balões, na ordem em que aparecem. */
  mensagens?: { de: string; texto: string }[];
  show_logo: boolean;
  palette: { ink: string; surface: string; accent: string };
  /** A tipografia da marca, lida do site no onboarting. */
  typography?: { headline: string; body: string };
  layout: Record<string, any>;
  scrim: number;
};

export const DEFAULT_LAYOUT = {
  arquetipo: "coluna",
  headline: { x: 6, y: 62, size: 7.5, weight: 600, align: "left" },
  sub: { x: 6, y: 74, size: 3.6 },
  cta: { x: 6, y: 86, style: "solid" },
  logo: { x: 6, y: 6, size: 8 },
  scrim: "bottom",
};

export function emptyComposition(format: Format = "4:5"): Composition {
  return {
    template_key: "produto-destaque",
    format,
    headline: "",
    subheadline: "",
    body: "",
    cta: "",
    price: "",
    bullets: [],
    pergunta: "",
    opcoes: [],
    mensagens: [],
    show_logo: true,
    palette: { ink: "#171412", surface: "#FFFDFA", accent: "#B4623A" },
    typography: { headline: "Inter", body: "Inter" },
    layout: DEFAULT_LAYOUT,
    scrim: 0.45,
  };
}

export function scrimGradient(kind: string, strength: number): string {
  const alpha = Math.min(0.85, Math.max(0, strength));
  switch (kind) {
    case "full":
      return `linear-gradient(0deg, rgba(0,0,0,${alpha}) 0%, rgba(0,0,0,${alpha * 0.7}) 100%)`;
    case "left":
      return `linear-gradient(90deg, rgba(0,0,0,${alpha}) 0%, rgba(0,0,0,0) 70%)`;
    case "bottom-soft":
      return `linear-gradient(0deg, rgba(0,0,0,${alpha * 0.6}) 0%, rgba(0,0,0,0) 45%)`;
    case "none":
      return "none";
    default:
      return `linear-gradient(0deg, rgba(0,0,0,${alpha}) 0%, rgba(0,0,0,${alpha * 0.5}) 30%, rgba(0,0,0,0) 62%)`;
  }
}

/**
 * Carrega a tipografia da marca do Google Fonts.
 *
 * A peça precisa sair na fonte da marca — usar Inter em tudo é o que fazia o
 * criativo parecer um template genérico com a foto dela dentro. Família que não
 * existe no Google Fonts não resolve, e a peça cai para a fonte do app, que é
 * exatamente o que se quer nesse caso.
 */
export function useFonteDaMarca(typography?: { headline: string; body: string }) {
  const chave = [typography?.headline, typography?.body]
    .map((nome) => (nome ?? "").trim())
    .filter((nome) => nome && !/^(inter|dm mono)$/i.test(nome))
    .join("|");

  React.useEffect(() => {
    if (!chave) return;
    for (const familia of chave.split("|")) {
      const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(familia).replace(/%20/g, "+")}:wght@400;500;600;700;800&display=swap`;
      if (document.head.querySelector(`link[href="${CSS.escape(href)}"]`)) continue;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.append(link);
    }
  }, [chave]);
}

/** Pilha de fontes com a da marca na frente e a do app como rede. */
export function pilhaDeFonte(familia?: string): string {
  const nome = (familia ?? "").trim();
  return nome ? `"${nome}", Inter, sans-serif` : "Inter, sans-serif";
}

/**
 * O que cada arquétipo precisa para se desenhar.
 *
 * `px` converte porcentagem da largura em pixels do tamanho real: toda medida
 * é relativa, então a mesma peça sai igual em 1080 e em qualquer outro tamanho.
 */
export type Palco = {
  composition: Composition;
  layout: Record<string, any>;
  px: (percent: number) => number;
  size: { width: number; height: number };
  imageUrl: string | null;
  logoUrl?: string | null;
};

export function medidas(format: Format) {
  const size = FORMAT_SIZE[format] ?? FORMAT_SIZE["4:5"];
  return { size, px: (percent: number) => (size.width * percent) / 100 };
}

/**
 * Palavras marcadas com *asterisco* saem na cor de acento.
 *
 * É a forma de destacar termo dentro da headline que aparece em quase todo
 * anúncio bom — e fica sob controle de quem escreve a copy, em vez de o
 * renderizador adivinhar qual palavra importa.
 */
export function comDestaque(texto: string, cor: string): React.ReactNode[] {
  return texto.split(/(\*[^*]+\*)/g).map((parte, indice) =>
    parte.startsWith("*") && parte.endsWith("*") && parte.length > 2
      ? React.createElement("span", { key: indice, style: { color: cor } }, parte.slice(1, -1))
      : React.createElement(React.Fragment, { key: indice }, parte),
  );
}

/** Texto sem as marcas de destaque — para alt, nome de arquivo e listagem. */
export function semMarcas(texto: string): string {
  return texto.replace(/\*([^*]+)\*/g, "$1");
}
