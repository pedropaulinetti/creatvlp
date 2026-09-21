import * as React from "react";
import { comDestaque, pilhaDeFonte, scrimGradient, type Palco } from "./composicao";

/*
 * Os arquétipos.
 *
 * Cada um é uma forma diferente de anunciar, não a mesma coluna de texto em
 * outra altura. Saíram das referências reais separadas para o produto: o bloco
 * de cor da Insider, o listicle da Goodnight Tape, a manchete de jornal, o
 * painel de números do Dr. Squatch, a palavra destacada da PRIMALS.
 *
 * Todos desenham só texto, cor e recorte. A fotografia vem do modelo e o texto
 * é sempre nosso — é o que garante ortografia certa e peça editável depois.
 */

/** A fotografia, ou a hachura de quando ela ainda não existe. */
export function Fundo({ imageUrl, style }: { imageUrl: string | null; style?: React.CSSProperties }) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt=""
        crossOrigin="anonymous"
        style={{ width: "100%", height: "100%", objectFit: "cover", ...style }}
      />
    );
  }
  return (
    <div
      aria-hidden
      style={{
        width: "100%",
        height: "100%",
        backgroundImage: "repeating-linear-gradient(-45deg, #F0ECE4 0 24px, #F4F1EA 24px 48px)",
        ...style,
      }}
    />
  );
}

export function Logo({ palco, claro }: { palco: Palco; claro: boolean }) {
  const { composition, layout, px, logoUrl } = palco;
  if (!composition.show_logo || !logoUrl) return null;
  return (
    <img
      src={logoUrl}
      alt=""
      crossOrigin="anonymous"
      style={{
        position: "absolute",
        left: px(layout.logo?.x ?? 6),
        top: px(layout.logo?.y ?? 6),
        height: px(layout.logo?.size ?? 8) / 2.4,
        width: "auto",
        filter: claro ? "none" : "brightness(0) invert(1)",
      }}
    />
  );
}

/** Botão em pílula, com seta — o formato que aparece em quase toda referência. */
function Pilula({
  texto,
  palco,
  cor,
  corDoTexto,
  tamanho = 4.1,
}: {
  texto: string;
  palco: Palco;
  cor: string;
  corDoTexto: string;
  tamanho?: number;
}) {
  const { px } = palco;
  if (!texto) return null;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: px(1.2),
        alignSelf: "flex-start",
        padding: `${px(2.4)}px ${px(4.6)}px`,
        borderRadius: px(9),
        background: cor,
        color: corDoTexto,
        fontSize: px(tamanho),
        fontWeight: 600,
        lineHeight: 1.2,
      }}
    >
      {texto}
      <span aria-hidden style={{ fontSize: px(tamanho * 0.9) }}>→</span>
    </div>
  );
}

// ------------------------------------------------------------------- coluna
/** O clássico: fotografia inteira, texto ancorado num canto. */
/**
 * A lista de argumentos, com caixa de seleção.
 *
 * Era um "✓" de 3,4% de largura colado no texto, que no feed vira ruído
 * cinza. Nos anúncios que funcionam a lista é um bloco legível de longe: caixa
 * desenhada, item em duas linhas quando precisa, corpo perto do tamanho do
 * apoio. É o segundo lugar onde o olho pousa, depois do título.
 */
/**
 * A largura média de uma letra em caixa alta, em relação ao corpo.
 *
 * Medida na Inter em peso 800, que é o que o título usa. Serve de estimativa
 * para caber a palavra na coluna sem medir o texto no DOM, que só existiria
 * depois de pintar e obrigaria a repintar.
 */
const LARGURA_DA_LETRA = 0.62;

/**
 * O corpo do título, pelo texto E pela coluna onde ele cabe.
 *
 * Duas coisas limitam, e as duas precisam valer ao mesmo tempo.
 *
 * O comprimento total: "Mais volume" em 11% enche o quadro com graça, e a
 * frase inteira no mesmo corpo vira seis linhas que engolem a lista e o botão.
 *
 * E a maior palavra, que é a que estava cortando. Palavra não quebra: numa
 * coluna estreita, "TRATAMENTO" em corpo grande simplesmente sai pela direita
 * e o `overflow: hidden` come as últimas letras. Medido numa peça real, saiu
 * "TRATAMEN" e "COMPLET". Quem manda é a mais restritiva das duas.
 */
export function corpoDoTitulo(
  texto: string,
  teto: number,
  piso: number,
  /** Largura útil da coluna, na mesma unidade do corpo: % da peça. */
  larguraDaColuna?: number,
): number {
  const limpo = texto.trim();
  const letras = limpo.length;
  const peloComprimento =
    letras <= 22 ? teto : letras >= 78 ? piso : teto - ((letras - 22) / 56) * (teto - piso);

  if (!larguraDaColuna) return peloComprimento;

  const maiorPalavra = limpo
    .split(/\s+/)
    .reduce((maior, palavra) => Math.max(maior, palavra.length), 0);
  if (!maiorPalavra) return peloComprimento;

  // 0,96 de folga: a estimativa erra por pouco, e errar para dentro é barato.
  const pelaPalavra = (larguraDaColuna * 0.96) / (maiorPalavra * LARGURA_DA_LETRA);

  // O piso absoluto evita que uma palavra gigante reduza o título a nada.
  return Math.max(3.6, Math.min(peloComprimento, pelaPalavra));
}

/**
 * As três alavancas que a copy entrega junto do arquétipo.
 *
 * Escala, alinhamento e âncora não são enfeite: são a diferença entre a peça
 * repetir o mesmo desenho com outro texto e a estrutura acompanhar o
 * argumento. Quem escreveu "Qual seu maior desafio?" pediu título discreto;
 * quem escreveu "13% mais volume" pediu dominante.
 *
 * O vocabulário é fechado e valor desconhecido cai no padrão, então nenhuma
 * escolha do modelo consegue quebrar o desenho.
 */
const FATOR_DA_ESCALA: Record<string, number> = {
  dominante: 1.32,
  equilibrada: 1,
  discreta: 0.76,
};

export function escalaDoTitulo(layout: Record<string, unknown>): number {
  return FATOR_DA_ESCALA[String(layout.escala ?? "")] ?? 1;
}

export function alinhamentoDoTexto(layout: Record<string, unknown>): "left" | "center" {
  return layout.alinhamento === "centro" ? "center" : "left";
}

/** Verdadeiro quando o texto pousa no topo em vez do rodapé. */
export function ancoraNoTopo(layout: Record<string, unknown>): boolean {
  return layout.ancora === "topo";
}

export function Checklist({
  itens,
  palco,
  cor,
  corDaCaixa,
  tamanho = 4.2,
}: {
  itens: string[];
  palco: Palco;
  cor: string;
  corDaCaixa?: string;
  tamanho?: number;
}) {
  const { px } = palco;
  if (!itens.length) return null;
  const lado = px(tamanho * 1.15);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: px(tamanho * 0.62) }}>
      {itens.map((item) => (
        <div key={item} style={{ display: "flex", alignItems: "flex-start", gap: px(tamanho * 0.62) }}>
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: lado,
              height: lado,
              marginTop: px(tamanho * 0.16),
              borderRadius: px(0.9),
              border: `${Math.max(1, px(0.35))}px solid ${corDaCaixa ?? cor}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: corDaCaixa ?? cor,
              fontSize: lado * 0.78,
              lineHeight: 1,
            }}
          >
            ✓
          </span>
          <span style={{ color: cor, fontSize: px(tamanho), lineHeight: 1.22, textWrap: "balance" }}>
            {item}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Coluna({ palco }: { palco: Palco }) {
  const { composition, layout, px, imageUrl } = palco;
  const claro = layout.scrim === "none";
  const corDoTexto = claro ? composition.palette.ink : "#FFFFFF";
  const margem = px(8);
  /*
   * A âncora e o alinhamento saem da escolha da copy, com o `y` antigo de
   * reserva: peça gerada antes de 21/09 não tem `ancora` no layout e precisa
   * continuar desenhando onde desenhava.
   */
  const noTopo = layout.ancora ? ancoraNoTopo(layout) : Number(layout.headline?.y ?? 62) < 35;
  const ancora = noTopo ? { top: margem } : { bottom: margem };
  const alinhamento = layout.alinhamento
    ? alinhamentoDoTexto(layout)
    : ((layout.headline?.align ?? "left") as "left" | "center" | "right");

  return (
    <>
      <div style={{ position: "absolute", inset: 0 }}>
        <Fundo imageUrl={imageUrl} />
      </div>
      <div
        aria-hidden
        style={{ position: "absolute", inset: 0, background: scrimGradient(String(layout.scrim ?? "bottom"), composition.scrim) }}
      />
      <Logo palco={palco} claro={claro} />

      {/*
        O bloco flui numa coluna ancorada, em vez de cada elemento ter altura
        fixa: com altura fixa, headline de três linhas invadia a subheadline.
      */}
      <div
        style={{
          position: "absolute",
          left: px(layout.headline?.x ?? 6),
          right: px(layout.headline?.x ?? 6),
          ...ancora,
          display: "flex",
          flexDirection: "column",
          gap: px(1.8),
          alignItems: alinhamento === "center" ? "center" : alinhamento === "right" ? "flex-end" : "flex-start",
          textAlign: alinhamento,
        }}
      >
        {composition.headline && (
          <div
            style={{
              color: corDoTexto,
              fontFamily: pilhaDeFonte(composition.typography?.headline),
              fontSize: px((layout.headline?.size ?? 7.5) * escalaDoTitulo(layout)),
              fontWeight: layout.headline?.weight ?? 600,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            {layout.headline?.quote ? "“" : ""}
            {comDestaque(composition.headline, composition.palette.accent)}
            {layout.headline?.quote ? "”" : ""}
          </div>
        )}

        {composition.subheadline && (
          <div style={{ color: corDoTexto, opacity: 0.92, fontSize: px(layout.sub?.size ?? 3.6), lineHeight: 1.35 }}>
            {composition.subheadline}
          </div>
        )}

        {composition.price && (
          <div
            style={{
              color: composition.palette.accent,
              fontFamily: pilhaDeFonte(composition.typography?.headline),
              fontSize: px(layout.price?.size ?? 9),
              fontWeight: layout.price?.weight ?? 700,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {composition.price}
          </div>
        )}

        {composition.cta && (
          <div
            style={{
              marginTop: px(1.2),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: layout.cta?.style === "link" ? 0 : `${px(1.6)}px ${px(3.4)}px`,
              borderRadius: px(1.2),
              background: layout.cta?.style === "solid" ? composition.palette.accent : "transparent",
              border: layout.cta?.style === "outline" ? `${px(0.28)}px solid ${corDoTexto}` : "none",
              color: layout.cta?.style === "solid" ? "#FFFFFF" : corDoTexto,
              fontSize: px(3.3),
              fontWeight: 500,
              lineHeight: 1.2,
              textDecoration: layout.cta?.style === "link" ? "underline" : "none",
              textUnderlineOffset: px(0.6),
            }}
          >
            {composition.cta}
          </div>
        )}
      </div>
    </>
  );
}

// -------------------------------------------------------------------- bloco
/**
 * Bloco de cor sólido, tipografia enorme, itens marcados e pílula embaixo.
 *
 * A fotografia entra pequena, num recorte. É a peça de oferta das referências
 * da Insider: quem rola o feed lê a promessa antes de ver a imagem.
 */
export function Bloco({ palco }: { palco: Palco }) {
  const { composition, px, imageUrl } = palco;
  const fundo = composition.palette.ink;
  const corDoTexto = "#FFFFFF";
  const itens = (composition.bullets ?? []).slice(0, 3);

  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: fundo }} />
      <Logo palco={palco} claro={false} />

      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: px(8),
          paddingTop: px(16),
          display: "flex",
          flexDirection: "column",
          gap: px(3),
        }}
      >
        <div
          style={{
            color: corDoTexto,
            fontFamily: pilhaDeFonte(composition.typography?.headline),
            fontSize: px(10 * escalaDoTitulo(palco.layout)),
            fontWeight: 800,
            lineHeight: 0.98,
            letterSpacing: "-0.04em",
            textTransform: "uppercase",
            textWrap: "balance",
          }}
        >
          {comDestaque(composition.headline, composition.palette.accent)}
        </div>

        <Checklist itens={itens} palco={palco} cor={corDoTexto} corDaCaixa={composition.palette.accent} />

        {composition.price && (
          <div
            style={{
              color: composition.palette.accent,
              fontFamily: pilhaDeFonte(composition.typography?.headline),
              fontSize: px(11),
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {composition.price}
          </div>
        )}

        {/*
          A foto absorve o que sobrar, em vez de reservar 38% fixos. Com a
          lista maior, a altura fixa empurrava a pílula para fora do quadro.
        */}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: px(3), flex: 1, minHeight: 0 }}>
          {imageUrl && (
            <div style={{ flex: 1, minHeight: px(16), borderRadius: px(3), overflow: "hidden" }}>
              <Fundo imageUrl={imageUrl} />
            </div>
          )}
          <Pilula texto={composition.cta} palco={palco} cor={composition.palette.accent} corDoTexto="#FFFFFF" />
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------- listicle
/** Título em cima, itens numerados embaixo, sobre a fotografia escurecida. */
export function Listicle({ palco }: { palco: Palco }) {
  const { composition, px, imageUrl } = palco;
  const itens = (composition.bullets ?? []).slice(0, 5);

  return (
    <>
      <div style={{ position: "absolute", inset: 0 }}>
        <Fundo imageUrl={imageUrl} />
      </div>
      <div aria-hidden style={{ position: "absolute", inset: 0, background: scrimGradient("full", 0.72) }} />
      <Logo palco={palco} claro={false} />

      <div style={{ position: "absolute", inset: 0, padding: px(8), paddingTop: px(17), display: "flex", flexDirection: "column", gap: px(4) }}>
        <div
          style={{
            color: "#FFFFFF",
            fontFamily: pilhaDeFonte(composition.typography?.headline),
            fontSize: px(8),
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            textWrap: "balance",
          }}
        >
          {comDestaque(composition.headline, composition.palette.accent)}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: px(2.2) }}>
          {itens.map((item, indice) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: px(2.4) }}>
              <span
                aria-hidden
                style={{
                  flexShrink: 0,
                  width: px(6),
                  height: px(6),
                  borderRadius: px(9),
                  background: composition.palette.accent,
                  color: "#FFFFFF",
                  fontSize: px(3),
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {indice + 1}
              </span>
              <span style={{ color: "#FFFFFF", fontSize: px(3.5), lineHeight: 1.3 }}>{item}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto" }}>
          <Pilula texto={composition.cta} palco={palco} cor={composition.palette.accent} corDoTexto="#FFFFFF" />
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------- manchete
/** Faixa branca com manchete em cima, fotografia embaixo, legenda de jornal. */
export function Manchete({ palco }: { palco: Palco }) {
  const { composition, px, imageUrl } = palco;

  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: "#FFFFFF" }} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: px(7), paddingBottom: px(4), display: "flex", flexDirection: "column", gap: px(2.4) }}>
          <span
            style={{
              alignSelf: "flex-start",
              background: composition.palette.accent,
              color: "#FFFFFF",
              padding: `${px(0.8)}px ${px(2)}px`,
              fontSize: px(2.6),
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {composition.subheadline || "Notícia"}
          </span>
          <div
            style={{
              color: composition.palette.ink,
              fontFamily: pilhaDeFonte(composition.typography?.headline),
              fontSize: px(7.4),
              fontWeight: 700,
              lineHeight: 1.06,
              letterSpacing: "-0.02em",
              textWrap: "balance",
            }}
          >
            {comDestaque(composition.headline, composition.palette.accent)}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden" }}>
          <Fundo imageUrl={imageUrl} />
        </div>

        <div style={{ padding: px(5), display: "flex", flexDirection: "column", gap: px(2.4) }}>
          {composition.body && (
            <div style={{ color: composition.palette.ink, opacity: 0.72, fontSize: px(2.9), lineHeight: 1.4 }}>
              {composition.body}
            </div>
          )}
          <Pilula texto={composition.cta} palco={palco} cor={composition.palette.ink} corDoTexto="#FFFFFF" tamanho={3} />
        </div>
      </div>
    </>
  );
}

// ------------------------------------------------------------------ números
/** Fotografia de um lado, números grandes do outro. Prova em vez de promessa. */
export function Numeros({ palco }: { palco: Palco }) {
  const { composition, px, imageUrl } = palco;
  const itens = (composition.bullets ?? []).slice(0, 3);

  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: composition.palette.surface }} />

      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: px(7), paddingBottom: px(3) }}>
          <div
            style={{
              color: composition.palette.ink,
              fontFamily: pilhaDeFonte(composition.typography?.headline),
              fontSize: px(7),
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              textWrap: "balance",
            }}
          >
            {comDestaque(composition.headline, composition.palette.accent)}
          </div>
        </div>

        <div style={{ flex: 1, display: "flex", gap: px(4), padding: `0 ${px(7)}px`, alignItems: "center" }}>
          <div style={{ width: "42%", aspectRatio: "3 / 4", borderRadius: px(3), overflow: "hidden", flexShrink: 0 }}>
            <Fundo imageUrl={imageUrl} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: px(3), flex: 1 }}>
            {itens.map((item) => {
              // "94% recomendam" → o número manda, o resto explica.
              const [, numero, resto] = /^\s*([\d.,]+%?|\d+x)\s*(.*)$/.exec(item) ?? [, "", item];
              return (
                <div key={item} style={{ display: "flex", flexDirection: "column" }}>
                  {numero && (
                    <span
                      style={{
                        color: composition.palette.accent,
                        fontFamily: pilhaDeFonte(composition.typography?.headline),
                        fontSize: px(9),
                        fontWeight: 800,
                        lineHeight: 1,
                        letterSpacing: "-0.04em",
                      }}
                    >
                      {numero}
                    </span>
                  )}
                  <span style={{ color: composition.palette.ink, opacity: 0.78, fontSize: px(3.1), lineHeight: 1.3 }}>
                    {resto || item}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ padding: px(7), paddingTop: px(4) }}>
          <Pilula texto={composition.cta} palco={palco} cor={composition.palette.accent} corDoTexto="#FFFFFF" />
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------- destaque
/**
 * Fotografia inteira, headline embaixo com a palavra que importa em cor.
 *
 * É o formato mais direto das referências: a imagem prende, a palavra
 * destacada carrega o argumento, a pílula fecha.
 */
export function Destaque({ palco }: { palco: Palco }) {
  const { composition, px, imageUrl } = palco;

  return (
    <>
      <div style={{ position: "absolute", inset: 0 }}>
        <Fundo imageUrl={imageUrl} />
      </div>
      <div aria-hidden style={{ position: "absolute", inset: 0, background: scrimGradient("bottom", 0.8) }} />
      <Logo palco={palco} claro={false} />

      <div
        style={{
          position: "absolute",
          left: px(6),
          right: px(6),
          bottom: px(7),
          display: "flex",
          flexDirection: "column",
          gap: px(2.6),
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div
          style={{
            color: "#FFFFFF",
            fontFamily: pilhaDeFonte(composition.typography?.headline),
            fontSize: px(9),
            fontWeight: 800,
            lineHeight: 1.02,
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
            textWrap: "balance",
          }}
        >
          {comDestaque(composition.headline, composition.palette.accent)}
        </div>
        {composition.subheadline && (
          <div style={{ color: "#FFFFFF", opacity: 0.85, fontSize: px(3.2), lineHeight: 1.35 }}>
            {composition.subheadline}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <Pilula texto={composition.cta} palco={palco} cor={composition.palette.accent} corDoTexto="#FFFFFF" />
        </div>
      </div>
    </>
  );
}

/** Acima disso a contagem riscada vira mancha: o número ao lado basta. */
const MAX_RISCOS = 15;

// ------------------------------------------------------------------ enquete
/**
 * Uma pergunta escrita à mão, com as respostas riscadas embaixo.
 *
 * Não tem headline, nem subheadline, nem imagem: a pergunta é o anúncio.
 * É o formato que mais aparece nas referências e o que menos parecia possível
 * enquanto a copy só sabia produzir título e apoio.
 */
export function Enquete({ palco }: { palco: Palco }) {
  const { composition, px } = palco;
  const opcoes = (composition.opcoes ?? []).slice(0, 3);
  const maximo = Math.max(1, ...opcoes.map((opcao) => opcao.votos));

  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: composition.palette.surface }} />
      <Logo palco={palco} claro />

      <div style={{ position: "absolute", inset: 0, padding: px(9), paddingTop: px(17), display: "flex", flexDirection: "column", gap: px(7) }}>
        <div
          style={{
            color: composition.palette.ink,
            fontFamily: pilhaDeFonte(composition.typography?.headline),
            fontSize: px(7.6),
            fontWeight: 600,
            lineHeight: 1.15,
            letterSpacing: "-0.02em",
            textWrap: "balance",
          }}
        >
          {composition.pergunta || composition.headline}
        </div>

        <div style={{ display: "flex", gap: px(4), alignItems: "flex-start" }}>
          {opcoes.map((opcao, indice) => (
            <div key={opcao.texto} style={{ flex: 1, display: "flex", flexDirection: "column", gap: px(2) }}>
              <span style={{ color: composition.palette.ink, fontSize: px(3.4), lineHeight: 1.25 }}>{opcao.texto}</span>
              <span aria-hidden style={{ height: px(0.4), background: composition.palette.ink, opacity: 0.35 }} />

              {/*
                Contagem riscada: quatro barras e a quinta cortando, como no
                papel. Acima de quinze o risco vira mancha ilegível, então o
                desenho para e o número ao lado é que conta a história.
              */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: px(0.9), alignItems: "flex-end", minHeight: px(7) }}>
                {Array.from({ length: Math.min(opcao.votos, MAX_RISCOS) }).map((_, risco) => (
                  <span
                    key={risco}
                    aria-hidden
                    style={{
                      display: "block",
                      width: px(0.55),
                      height: px(5),
                      background: indice === opcoes.findIndex((o) => o.votos === maximo)
                        ? composition.palette.accent
                        : composition.palette.ink,
                      transform: (risco + 1) % 5 === 0 ? "rotate(72deg) translateX(-12%)" : "rotate(-4deg)",
                      marginLeft: (risco + 1) % 5 === 0 ? px(-3.2) : 0,
                    }}
                  />
                ))}
              </div>
              <span style={{ color: composition.palette.ink, opacity: 0.5, fontSize: px(2.7) }}>{opcao.votos}</span>
            </div>
          ))}
        </div>

        <div style={{ marginTop: "auto" }}>
          <Pilula texto={composition.cta} palco={palco} cor={composition.palette.accent} corDoTexto="#FFFFFF" />
        </div>
      </div>
    </>
  );
}

// ----------------------------------------------------------------- conversa
/**
 * Um print de conversa entre um cliente e a marca.
 *
 * Também sem headline: o anúncio é a troca de mensagens. A dúvida de quem está
 * decidindo comprar convence mais que qualquer promessa escrita em caixa alta.
 */
export function Conversa({ palco }: { palco: Palco }) {
  const { composition, px } = palco;
  const mensagens = (composition.mensagens ?? []).slice(0, 5);

  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: composition.palette.surface }} />
      <Logo palco={palco} claro />

      <div style={{ position: "absolute", inset: 0, padding: px(7), paddingTop: px(17), display: "flex", flexDirection: "column", gap: px(2.4) }}>
        {mensagens.map((mensagem, indice) => {
          const daMarca = mensagem.de === "marca";
          return (
            <div
              key={indice}
              style={{
                alignSelf: daMarca ? "flex-end" : "flex-start",
                maxWidth: "78%",
                padding: `${px(2.6)}px ${px(3.2)}px`,
                borderRadius: px(4),
                borderBottomRightRadius: daMarca ? px(0.8) : px(4),
                borderBottomLeftRadius: daMarca ? px(4) : px(0.8),
                background: daMarca ? composition.palette.accent : "rgba(0,0,0,0.06)",
                color: daMarca ? "#FFFFFF" : composition.palette.ink,
                fontSize: px(3.5),
                lineHeight: 1.35,
              }}
            >
              {mensagem.texto}
            </div>
          );
        })}

        <div style={{ marginTop: "auto" }}>
          <Pilula texto={composition.cta} palco={palco} cor={composition.palette.ink} corDoTexto="#FFFFFF" />
        </div>
      </div>
    </>
  );
}

/** Qual arquétipo desenha esta composição. */
// ------------------------------------------------------------------ vitrine
/**
 * Coluna de texto à esquerda, produto sangrando pela direita.
 *
 * É a estrutura do anúncio de performance que mais roda em stories: título
 * gigante ocupando quase metade da altura, lista de argumentos com caixa de
 * seleção, botão largo no rodapé, e o produto grande, cortado pela borda, sem
 * cena nenhuma em volta.
 *
 * Faltava justamente ela. Os oito arquétipos anteriores punham a fotografia
 * como fundo ou dentro de uma caixinha, e caixinha de foto é cara de post, não
 * de anúncio. Aqui o produto é elemento de layout: ele invade o quadro.
 */
/** 53% de coluna menos 7% de recuo de cada lado. */
const LARGURA_UTIL_DA_VITRINE = 53 - 7 * 2;

export function Vitrine({ palco }: { palco: Palco }) {
  const { composition, px, imageUrl } = palco;
  const { ink, surface, accent } = composition.palette;
  const alto = composition.format === "9:16";
  // O 9:16 tem altura de sobra; o 4:5 não: um item a menos evita o corte.
  const itens = (composition.bullets ?? []).slice(0, alto ? 4 : 3);
  /*
   * O teto do título é maior no vertical alto pelo mesmo motivo do vão: o
   * corpo é medido em % da largura, e no 9:16 a peça é quase o dobro de alta.
   * O mesmo 11% que enche o 4:5 deixa o 9:16 com cara de post pequeno.
   */
  const teto = (alto ? 14 : 11) * escalaDoTitulo(palco.layout);

  return (
    <>
      {/* Fundo liso com uma sombra suave: o produto precisa de ar, não de cena. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(160deg, ${surface} 0%, ${surface} 55%, rgba(0,0,0,0.05) 100%)`,
        }}
      />

      {/*
        O produto sangra pela direita e desce até a base. Cortar de propósito é
        o que dá escala: produto inteiro e centrado lê como foto de catálogo.
      */}
      {imageUrl && (
        <div
          style={{
            position: "absolute",
            right: px(-8),
            top: px(8),
            width: "52%",
            height: "84%",
          }}
        >
          <img
            src={imageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "left center" }}
          />
        </div>
      )}

      <Logo palco={palco} claro />

      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: px(7),
          paddingTop: px(11),
          /*
           * O botão fica preso no rodapé, e a coluna reserva o espaço dele.
           * Empilhado em fluxo, ele era o primeiro a sair do quadro quando o
           * título vinha longo: a peça perdia justamente a chamada para ação.
           */
          paddingBottom: px(19),
          display: "flex",
          flexDirection: "column",
          /*
           * Bloco centrado no que sobra entre o topo e o botão.
           *
           * Empilhado a partir do topo, o 9:16 ficava com o texto agarrado em
           * cima e um vão vazio de um terço da peça até a pílula: `px()` é
           * porcentagem da LARGURA, e no vertical alto a altura sobra muito.
           */
          justifyContent: "center",
          gap: px(3.5),
          // A coluna para antes do produto: texto por cima da embalagem não lê.
          width: "53%",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            color: ink,
            fontFamily: pilhaDeFonte(composition.typography?.headline),
            fontSize: px(corpoDoTitulo(composition.headline, teto, 6.2, LARGURA_UTIL_DA_VITRINE)),
            fontWeight: 800,
            lineHeight: 0.94,
            letterSpacing: "-0.03em",
            textTransform: "uppercase",
          }}
        >
          {comDestaque(composition.headline, accent)}
        </div>

        <Checklist itens={itens} palco={palco} cor={ink} tamanho={itens.length > 2 ? 3.4 : 4.2} />
      </div>

      <div style={{ position: "absolute", left: px(7), bottom: px(7) }}>
        <Pilula texto={composition.cta} palco={palco} cor={ink} corDoTexto={surface} tamanho={4.4} />
      </div>
    </>
  );
}

export const ARQUETIPOS: Record<string, (props: { palco: Palco }) => React.JSX.Element> = {
  coluna: Coluna,
  vitrine: Vitrine,
  bloco: Bloco,
  listicle: Listicle,
  manchete: Manchete,
  numeros: Numeros,
  destaque: Destaque,
  enquete: Enquete,
  conversa: Conversa,
};
