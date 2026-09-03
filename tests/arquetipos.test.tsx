/**
 * Os arquétipos precisam ser formas diferentes de anunciar, não a mesma coluna
 * de texto em alturas diferentes — que era exatamente o problema da versão
 * anterior, em que nove peças pareciam três.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreativeCanvas } from "@/features/creatives/CreativeCanvas";
import { emptyComposition, comDestaque, semMarcas } from "@/features/creatives/composicao";
import type { Composition } from "@/features/creatives/composicao";

function comArquetipo(arquetipo: string, extra: Partial<Composition> = {}): Composition {
  return {
    ...emptyComposition("4:5"),
    headline: "Seu café *não amassa* na mochila",
    subheadline: "Tecido técnico, seca rápido.",
    cta: "Comprar agora",
    bullets: ["94% recomendam", "Não amassa", "Antiodor"],
    palette: { ink: "#171412", surface: "#FFFDFA", accent: "#B4623A" },
    typography: { headline: "Lora", body: "Inter" },
    layout: { arquetipo },
    ...extra,
  };
}

const desenhar = (composition: Composition) =>
  render(<CreativeCanvas imageUrl={null} composition={composition} format="4:5" />);

describe("marcação de destaque na headline", () => {
  it("pinta só o que está entre asteriscos", () => {
    const partes = comDestaque("Seu café *não amassa* aqui", "#B4623A");
    expect(partes).toHaveLength(3);
  });

  it("headline sem marca nenhuma continua inteira", () => {
    expect(comDestaque("Sem marca aqui", "#B4623A")).toHaveLength(1);
  });

  it("tira as marcas de quem precisa do texto puro", () => {
    expect(semMarcas("Seu café *não amassa* aqui")).toBe("Seu café não amassa aqui");
  });
});

describe("cada arquétipo desenha algo diferente", () => {
  it("a lista numerada mostra os itens numerados", () => {
    desenhar(comArquetipo("listicle"));
    expect(screen.getByText("94% recomendam")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("o bloco de oferta marca os benefícios com visto", () => {
    const { container } = desenhar(comArquetipo("bloco"));
    expect(screen.getByText("Não amassa")).toBeInTheDocument();
    expect(container.textContent).toContain("✓");
  });

  it("o painel de números separa o número da explicação", () => {
    desenhar(comArquetipo("numeros"));
    expect(screen.getByText("94%")).toBeInTheDocument();
    expect(screen.getByText("recomendam")).toBeInTheDocument();
  });

  it("a manchete usa a subheadline como tarja da notícia", () => {
    desenhar(comArquetipo("manchete", { subheadline: "Urgente" }));
    expect(screen.getByText("Urgente")).toBeInTheDocument();
  });

  it("a coluna clássica não inventa item de lista nenhum", () => {
    desenhar(comArquetipo("coluna"));
    expect(screen.queryByText("94% recomendam")).not.toBeInTheDocument();
  });

  it("arquétipo desconhecido cai na coluna em vez de sumir com a peça", () => {
    desenhar(comArquetipo("inexistente"));
    expect(screen.getByText("Comprar agora")).toBeInTheDocument();
  });
});

describe("a tipografia da marca chega até a peça", () => {
  it("a headline usa a fonte de título da marca, não a do app", () => {
    // O renderizador tinha Inter fixo: a peça saía com a fonte do CreatvOS.
    const { container } = desenhar(comArquetipo("coluna"));
    const comLora = [...container.querySelectorAll<HTMLElement>("*")].filter((no) =>
      no.style.fontFamily.includes("Lora"),
    );
    expect(comLora.length).toBeGreaterThan(0);
  });

  it("marca sem tipografia lida cai para a fonte do app", () => {
    const { container } = desenhar(comArquetipo("coluna", { typography: undefined }));
    const fontes = [...container.querySelectorAll<HTMLElement>("*")].map((no) => no.style.fontFamily);
    expect(fontes.some((familia) => familia.includes("Inter"))).toBe(true);
    expect(fontes.some((familia) => familia.includes("Lora"))).toBe(false);
  });
});

describe("arquétipos sem headline", () => {
  /*
   * A queixa que motivou isto: os arquétipos mudavam o arranjo, não a
   * estrutura. Todos eram título + apoio + botão com a foto atrás. Nestes dois
   * não existe headline, e a peça precisa se sustentar sem ela.
   */
  it("a enquete mostra a pergunta e as respostas, sem headline nenhuma", () => {
    const { container } = desenhar(
      comArquetipo("enquete", {
        headline: "",
        subheadline: "",
        pergunta: "De quantos em quantos meses você troca de camiseta?",
        opcoes: [
          { texto: "Todo mês", votos: 4 },
          { texto: "A cada 3 meses", votos: 6 },
          { texto: "Quando lembro", votos: 2 },
        ],
      }),
    );
    expect(screen.getByText(/De quantos em quantos meses/)).toBeInTheDocument();
    expect(screen.getByText("A cada 3 meses")).toBeInTheDocument();
    expect(container.textContent).not.toContain("Seu café");
  });

  it("a conversa desenha um balão por mensagem", () => {
    desenhar(
      comArquetipo("conversa", {
        headline: "",
        mensagens: [
          { de: "pessoa", texto: "essa camiseta amassa na mala?" },
          { de: "marca", texto: "não amassa — o tecido volta sozinho." },
        ],
      }),
    );
    expect(screen.getByText("essa camiseta amassa na mala?")).toBeInTheDocument();
    expect(screen.getByText("não amassa — o tecido volta sozinho.")).toBeInTheDocument();
  });

  it("os dois mantêm o botão: é o que leva para a loja", () => {
    desenhar(comArquetipo("enquete", { headline: "", pergunta: "Com que frequência?" }));
    expect(screen.getByText("Comprar agora")).toBeInTheDocument();
  });

  it("enquete sem pergunta escrita cai para a headline em vez de sair vazia", () => {
    desenhar(comArquetipo("enquete", { pergunta: "" }));
    expect(screen.getByText(/Seu café/)).toBeInTheDocument();
  });
});
