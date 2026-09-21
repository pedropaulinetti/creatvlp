import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ehArquivoDeDeployAntigo, recarregarPorDeploy } from "../src/lib/stale-chunk";

const recarregar = vi.fn();

beforeEach(() => {
  recarregar.mockClear();
  window.sessionStorage.clear();
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload: recarregar },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ehArquivoDeDeployAntigo", () => {
  it("reconhece a falha de import dinâmico do Chrome", () => {
    const erro = new Error(
      "Failed to fetch dynamically imported module: https://www.creatv.com.br/assets/HomePage-CH1sSb5I.js",
    );
    expect(ehArquivoDeDeployAntigo(erro)).toBe(true);
  });

  it("reconhece a variação do Safari", () => {
    expect(ehArquivoDeDeployAntigo(new Error("Importing a module script failed."))).toBe(true);
  });

  it("não confunde com erro comum da página", () => {
    expect(ehArquivoDeDeployAntigo(new Error("Cannot read properties of undefined"))).toBe(false);
  });
});

describe("recarregarPorDeploy", () => {
  it("recarrega na primeira vez", () => {
    expect(recarregarPorDeploy()).toBe(true);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("não entra em laço se o arquivo continuar faltando", () => {
    recarregarPorDeploy();
    expect(recarregarPorDeploy()).toBe(false);
    expect(recarregar).toHaveBeenCalledTimes(1);
  });

  it("volta a recarregar depois que a janela passa", () => {
    vi.useFakeTimers();
    recarregarPorDeploy();
    vi.advanceTimersByTime(20_000);
    expect(recarregarPorDeploy()).toBe(true);
    expect(recarregar).toHaveBeenCalledTimes(2);
  });
});
