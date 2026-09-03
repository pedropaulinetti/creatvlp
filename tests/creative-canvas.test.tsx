import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreativeCanvas, emptyComposition } from "@/features/creatives/CreativeCanvas";
import { FORMAT_SIZE } from "@/lib/schemas";

const composition = {
  ...emptyComposition("4:5"),
  headline: "Café que seu pai vai lembrar",
  subheadline: "Torra da semana, entregue em casa",
  cta: "Comprar agora",
  price: "R$ 89,90",
};

describe("CreativeCanvas — composição determinística", () => {
  it("renderiza o texto pelo CreatvOS, não pela imagem", () => {
    render(
      <CreativeCanvas
        imageUrl="https://exemplo.com/fundo.png"
        logoUrl={null}
        composition={composition}
        format="4:5"
      />,
    );
    expect(screen.getByText("Café que seu pai vai lembrar")).toBeInTheDocument();
    expect(screen.getByText("Torra da semana, entregue em casa")).toBeInTheDocument();
    expect(screen.getByText("Comprar agora")).toBeInTheDocument();
  });

  it("usa o tamanho real do formato escolhido", () => {
    const { container } = render(
      <CreativeCanvas imageUrl={null} logoUrl={null} composition={composition} format="9:16" displayWidth={270} />,
    );
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner.style.width).toBe(`${FORMAT_SIZE["9:16"].width}px`);
    expect(inner.style.height).toBe(`${FORMAT_SIZE["9:16"].height}px`);
  });

  it("reduz por transform mantendo a proporção do formato", () => {
    const { container } = render(
      <CreativeCanvas imageUrl={null} logoUrl={null} composition={composition} format="1:1" displayWidth={270} />,
    );
    const inner = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(inner.style.transform).toBe(`scale(${270 / FORMAT_SIZE["1:1"].width})`);
  });

  it("mostra o preço quando ele existe na composição", () => {
    render(<CreativeCanvas imageUrl={null} logoUrl={null} composition={composition} format="4:5" />);
    expect(screen.getByText("R$ 89,90")).toBeInTheDocument();
  });

  it("omite o preço quando está vazio", () => {
    render(
      <CreativeCanvas imageUrl={null} logoUrl={null} composition={{ ...composition, price: "" }} format="4:5" />,
    );
    expect(screen.queryByText("R$ 89,90")).not.toBeInTheDocument();
  });

  it("empilha o texto num bloco que flui, sem alturas fixas", () => {
    // Altura fixa por elemento fazia a headline de três linhas invadir a
    // subheadline. Todos precisam viver no mesmo bloco em coluna.
    const { container } = render(
      <CreativeCanvas imageUrl={null} logoUrl={null} composition={composition} format="4:5" />,
    );
    const bloco = screen.getByText(composition.headline).parentElement!;
    expect(bloco.style.display).toBe("flex");
    expect(bloco.style.flexDirection).toBe("column");

    const textos = Array.from(bloco.children).map((filho) => (filho as HTMLElement).textContent);
    expect(textos).toEqual([
      composition.headline,
      composition.subheadline,
      composition.price,
      composition.cta,
    ]);
    void container;
  });

  it("aguenta headline longa sem perder subheadline nem CTA", () => {
    const longa = {
      ...composition,
      headline: "Uma headline bem longa que quebra em várias linhas e antes invadia o que vinha depois dela",
    };
    render(<CreativeCanvas imageUrl={null} logoUrl={null} composition={longa} format="4:5" />);
    expect(screen.getByText(longa.headline)).toBeInTheDocument();
    expect(screen.getByText(composition.subheadline)).toBeInTheDocument();
    expect(screen.getByText(composition.cta)).toBeInTheDocument();
  });

  it("ancora o bloco conforme a intenção do template", () => {
    const rodape = { ...composition, layout: { ...composition.layout, headline: { x: 6, y: 80, size: 5 } } };
    const { rerender } = render(
      <CreativeCanvas imageUrl={null} logoUrl={null} composition={rodape} format="4:5" />,
    );
    expect(screen.getByText(rodape.headline).parentElement!.style.bottom).not.toBe("");

    const topo = { ...composition, layout: { ...composition.layout, headline: { x: 6, y: 8, size: 5 } } };
    rerender(<CreativeCanvas imageUrl={null} logoUrl={null} composition={topo} format="4:5" />);
    expect(screen.getByText(topo.headline).parentElement!.style.top).not.toBe("");
  });

  it("marca a imagem de fundo como decorativa para leitores de tela", () => {
    const { container } = render(
      <CreativeCanvas
        imageUrl="https://exemplo.com/fundo.png"
        logoUrl={null}
        composition={composition}
        format="4:5"
      />,
    );
    const image = container.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveAttribute("crossorigin", "anonymous");
  });

  it("não quebra sem imagem-base, mostrando a hachura de espera", () => {
    const { container } = render(
      <CreativeCanvas imageUrl={null} logoUrl={null} composition={composition} format="4:5" />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Café que seu pai vai lembrar")).toBeInTheDocument();
  });

  it("omite campos vazios em vez de renderizar espaço morto", () => {
    render(
      <CreativeCanvas
        imageUrl={null}
        logoUrl={null}
        composition={{ ...composition, subheadline: "", cta: "" }}
        format="4:5"
      />,
    );
    expect(screen.queryByText("Torra da semana, entregue em casa")).not.toBeInTheDocument();
    expect(screen.queryByText("Comprar agora")).not.toBeInTheDocument();
  });
});
