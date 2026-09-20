import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CampoDeCodigo } from "../src/features/auth/CampoDeCodigo";

function montar(valor = "", aoMudar = vi.fn(), aoCompletar = vi.fn()) {
  render(<CampoDeCodigo valor={valor} aoMudar={aoMudar} aoCompletar={aoCompletar} />);
  return { aoMudar, aoCompletar, caixas: screen.getAllByRole("textbox") as HTMLInputElement[] };
}

describe("CampoDeCodigo", () => {
  it("mostra uma caixa por dígito", () => {
    expect(montar().caixas).toHaveLength(6);
  });

  it("digitar avança para a caixa seguinte", () => {
    const { aoMudar, caixas } = montar();
    fireEvent.change(caixas[0], { target: { value: "4" } });
    expect(aoMudar).toHaveBeenCalledWith("4");
  });

  it("recusa letra", () => {
    const { aoMudar, caixas } = montar();
    fireEvent.change(caixas[0], { target: { value: "a" } });
    expect(aoMudar).not.toHaveBeenCalled();
  });

  /*
   * Colar é o caminho mais comum: o código chega por e-mail. Colar na terceira
   * caixa tem de preencher o código inteiro, não só aquela posição.
   */
  it("colar preenche o código inteiro, de qualquer caixa", () => {
    const { aoMudar, caixas } = montar();
    fireEvent.paste(caixas[2], { clipboardData: { getData: () => "482913" } });
    expect(aoMudar).toHaveBeenCalledWith("482913");
  });

  it("colar limpa o que não é dígito e respeita o tamanho", () => {
    const { aoMudar, caixas } = montar();
    fireEvent.paste(caixas[0], { clipboardData: { getData: () => "48-29-13-99" } });
    expect(aoMudar).toHaveBeenCalledWith("482913");
  });

  it("avisa quando o código fica completo, sem precisar de clique", () => {
    const { aoCompletar, caixas } = montar();
    fireEvent.paste(caixas[0], { clipboardData: { getData: () => "482913" } });
    expect(aoCompletar).toHaveBeenCalledWith("482913");
  });

  it("backspace em caixa vazia apaga a anterior", () => {
    const { aoMudar, caixas } = montar("48");
    fireEvent.keyDown(caixas[2], { key: "Backspace" });
    expect(aoMudar).toHaveBeenCalledWith("4");
  });

  it("backspace em caixa preenchida apaga o próprio dígito", () => {
    const { aoMudar, caixas } = montar("482");
    fireEvent.keyDown(caixas[1], { key: "Backspace" });
    expect(aoMudar).toHaveBeenCalledWith("42");
  });

  it("marca as caixas como inválidas para o leitor de tela", () => {
    render(<CampoDeCodigo valor="4" aoMudar={vi.fn()} invalido />);
    expect(screen.getAllByRole("textbox")[0]).toHaveAttribute("aria-invalid", "true");
  });

  it("a primeira caixa recebe o preenchimento automático do código", () => {
    const { caixas } = montar();
    expect(caixas[0]).toHaveAttribute("autocomplete", "one-time-code");
  });
});
