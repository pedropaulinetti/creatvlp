/**
 * O papel da cor precisa ser editável onde a marca vive.
 *
 * O seletor existia só no onboarding. Em Minha Marca o papel era uma etiqueta
 * morta: dava para ver "apoio" numa cor que é a primária da marca e não tinha
 * como corrigir. Nem apagando e recriando, porque cor nova nascia como
 * "apoio". É o papel que decide qual cor pinta o fundo, qual pinta o texto e
 * qual vira o acento do CTA na peça.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CorDaPaleta, PAPEIS_DA_COR } from "@/features/brand/CorDaPaleta";

const cor = { hex: "#F5B700", role: "apoio", label: "" };

describe("CorDaPaleta", () => {
  it("oferece todos os papéis que a composição entende", () => {
    render(<CorDaPaleta cor={cor} aoMudar={() => {}} aoRemover={() => {}} />);
    const seletor = screen.getByLabelText("Papel de #F5B700") as HTMLSelectElement;

    expect([...seletor.options].map((o) => o.value)).toEqual([...PAPEIS_DA_COR]);
    expect(PAPEIS_DA_COR).toContain("primaria");
    expect(PAPEIS_DA_COR).toContain("secundaria");
  });

  it("trocar o papel avisa quem guarda a paleta", async () => {
    const usuario = userEvent.setup();
    const aoMudar = vi.fn();
    render(<CorDaPaleta cor={cor} aoMudar={aoMudar} aoRemover={() => {}} />);

    await usuario.selectOptions(screen.getByLabelText("Papel de #F5B700"), "primaria");
    expect(aoMudar).toHaveBeenCalledWith({ role: "primaria" });
  });

  it("papel desconhecido vindo da leitura cai em apoio, sem quebrar o seletor", () => {
    render(
      <CorDaPaleta cor={{ ...cor, role: "inventado" }} aoMudar={() => {}} aoRemover={() => {}} />,
    );
    expect((screen.getByLabelText("Papel de #F5B700") as HTMLSelectElement).value).toBe("apoio");
  });

  it("o hex continua editável pelo seletor de cor", () => {
    render(<CorDaPaleta cor={cor} aoMudar={() => {}} aoRemover={() => {}} />);
    expect(screen.getByLabelText("Cor #F5B700")).toBeTruthy();
  });

  it("remover avisa quem guarda a paleta", async () => {
    const usuario = userEvent.setup();
    const aoRemover = vi.fn();
    render(<CorDaPaleta cor={cor} aoMudar={() => {}} aoRemover={aoRemover} />);

    await usuario.click(screen.getByLabelText("Remover #F5B700"));
    expect(aoRemover).toHaveBeenCalledOnce();
  });
});
