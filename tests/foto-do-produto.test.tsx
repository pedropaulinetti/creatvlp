/**
 * A foto do produto é a referência mais valiosa que a marca tem: é o que a
 * peça precisa mostrar. Produto sem foto tinha de continuar sem, porque não
 * havia lugar nenhum no app para enviar uma.
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FotoDoProduto } from "@/components/FotoDoProduto";

vi.mock("@/lib/storage", () => ({
  signedUrl: vi.fn(async (_bucket: string, path: string | null) => (path ? `https://assinada/${path}` : null)),
}));

const naoEnvia = async () => {};

describe("FotoDoProduto", () => {
  it("sem foto, oferece o envio", () => {
    render(<FotoDoProduto nome="Bourbon Amarelo" aoEnviar={naoEnvia} />);
    expect(screen.getByLabelText("Enviar foto de Bourbon Amarelo")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("com foto guardada, mostra a nossa cópia e não o endereço de origem", async () => {
    render(
      <FotoDoProduto
        nome="Bourbon"
        imagePath="workspace/marca/produto/bourbon.jpg"
        imageUrl="https://loja.com.br/bourbon.jpg"
        aoEnviar={naoEnvia}
      />,
    );

    const foto = await screen.findByRole("img");
    expect(foto).toHaveAttribute("src", "https://assinada/workspace/marca/produto/bourbon.jpg");
  });

  it("sem cópia guardada, mostra a prévia da origem", () => {
    render(<FotoDoProduto nome="Bourbon" imageUrl="https://loja.com.br/bourbon.jpg" aoEnviar={naoEnvia} />);
    expect(screen.getByRole("img")).toHaveAttribute("src", "https://loja.com.br/bourbon.jpg");
  });

  it("com foto, o clique troca em vez de sumir", () => {
    render(<FotoDoProduto nome="Bourbon" imageUrl="https://loja.com.br/bourbon.jpg" aoEnviar={naoEnvia} />);
    expect(screen.getByLabelText("Trocar foto de Bourbon")).toBeInTheDocument();
  });

  it("envia o arquivo escolhido e mostra a prévia local enquanto guarda", async () => {
    const aoEnviar = vi.fn(async () => {});
    render(<FotoDoProduto nome="Bourbon" aoEnviar={aoEnviar} />);

    const arquivo = new File(["conteudo"], "foto.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Enviar foto de Bourbon"), arquivo);

    await waitFor(() => expect(aoEnviar).toHaveBeenCalledWith(arquivo));
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("não aceita SVG: o bucket de produto não guarda esse formato", () => {
    render(<FotoDoProduto nome="Bourbon" aoEnviar={naoEnvia} />);
    const entrada = screen.getByLabelText("Enviar foto de Bourbon");
    expect(entrada.getAttribute("accept")).not.toContain("svg");
    expect(entrada.getAttribute("accept")).toContain("image/png");
  });
});
