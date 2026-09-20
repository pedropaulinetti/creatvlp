/**
 * A amostra de tipografia precisa mostrar a LETRA, não só o nome.
 *
 * Nome de família escrito na fonte do sistema não é informação: "Rubik" em
 * Inter diz o mesmo que o campo vazio, e a tipografia é uma das coisas que
 * mais mudam a cara da peça gerada.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SequenciaDeLeitura } from "@/features/onboarding/SequenciaDeLeitura";
import { leituraVazia, type Leitura } from "@/features/onboarding/tipos";

// A amostra pede URL assinada; sem arquivo guardado a consulta nem roda.
vi.mock("@/features/creatives/useAssetUrls", () => ({
  useSignedUrls: () => ({ data: undefined }),
}));

function leituraCom(parcial: Partial<Leitura>): Leitura {
  const base = leituraVazia();
  return {
    ...base,
    estados: { ...base.estados, tipografia: "feito" },
    ...parcial,
  };
}

describe("amostra de tipografia da leitura", () => {
  it("escreve cada família na própria letra, com alfabeto", () => {
    render(
      <SequenciaDeLeitura
        leitura={leituraCom({ fontes: { headline: "Rubik", body: "Inter" } })}
      />,
    );

    const titulo = screen.getByText("Rubik");
    expect(titulo.style.fontFamily).toContain('"Rubik"');

    // Duas famílias distintas, duas amostras de alfabeto.
    expect(screen.getAllByText(/ABCDEFG abcdefg/)).toHaveLength(2);
  });

  it("não repete a amostra quando título e texto usam a mesma família", () => {
    render(
      <SequenciaDeLeitura
        leitura={leituraCom({ fontes: { headline: "Inter", body: "Inter" } })}
      />,
    );

    expect(screen.getAllByText(/ABCDEFG abcdefg/)).toHaveLength(1);
  });

  it("avisa quando o site não declarou família nenhuma", () => {
    render(<SequenciaDeLeitura leitura={leituraCom({ fontes: { headline: "", body: "" } })} />);
    expect(screen.getByText("nenhuma família declarada")).toBeTruthy();
  });
});
