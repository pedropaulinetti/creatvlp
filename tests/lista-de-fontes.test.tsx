/**
 * A conferência da marca mostra a fonte lida, não um campo em branco.
 *
 * Pedir para a pessoa digitar "Kefir" num input, depois de a leitura já ter
 * descoberto Kefir no CSS do site dela, é devolver o trabalho que o produto
 * acabou de fazer. E quando a letra na tela não é a dela, o que falta é o
 * arquivo, não a grafia do nome: o slot pede o arquivo, e marcar o papel é
 * consequência do envio.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ListaDeFontes } from "@/features/brand/ListaDeFontes";

/*
 * O jsdom não tem `FontFace` nem `document.fonts`, que são o que registra a
 * prévia no navegador. Sem o dublê, todo caso com arquivo quebra no efeito.
 */
beforeAll(() => {
  vi.stubGlobal(
    "FontFace",
    class {
      load() {
        return Promise.resolve(this);
      }
    },
  );
  Object.defineProperty(document, "fonts", { value: { add: () => {} }, configurable: true });
});

function montar(
  tipografia: { headline: string; body: string },
  fontes: { id: string; familia: string; url?: string | null }[] = [],
) {
  const aoMudarPapel = vi.fn();
  const aoEnviar = vi.fn(async () => {});
  render(
    <ListaDeFontes
      fontes={fontes}
      tipografia={tipografia}
      aoMudarPapel={aoMudarPapel}
      aoEnviar={aoEnviar}
      aoRemover={() => {}}
    />,
  );
  return { aoMudarPapel, aoEnviar };
}

describe("ListaDeFontes", () => {
  it("mostra a família lida como amostra, sem campo para digitar", () => {
    montar({ headline: "Kefir", body: "Commissioner" });

    const amostra = screen.getByText("Kefir");
    expect(amostra.style.fontFamily).toContain('"Kefir"');
    expect(screen.queryByLabelText("Fonte de destaque")).toBeNull();
  });

  it("diz que a letra é aproximada quando não há arquivo", () => {
    montar({ headline: "Kefir", body: "Commissioner" });
    expect(screen.getAllByText("letra aproximada")).toHaveLength(2);
  });

  it("confirma o arquivo da marca quando ele existe", () => {
    montar({ headline: "Kefir", body: "Kefir" }, [
      { id: "w/b/fonte/1.woff2", familia: "Kefir", url: "blob:kefir" },
    ]);

    expect(screen.getAllByText("arquivo da marca")).toHaveLength(2);
    expect(screen.queryByText("letra aproximada")).toBeNull();
  });

  it("envia o arquivo pelo slot e marca o papel", async () => {
    const usuario = userEvent.setup();
    const { aoEnviar, aoMudarPapel } = montar({ headline: "Kefir", body: "Commissioner" });

    const arquivo = new File([new Uint8Array([0, 1, 0, 0])], "Kefir-Regular.woff2");
    await usuario.upload(screen.getByLabelText("Enviar arquivo da fonte de destaque"), arquivo);

    expect(aoEnviar).toHaveBeenCalledOnce();
    /*
     * O binário não abre (WOFF2 usa Brotli) e o palpite pelo arquivo daria
     * "Kefir Regular". O nome lido do CSS do site é melhor, e é ele que vai
     * no prompt: o peso pendurado no fim seria ruído.
     */
    expect(aoMudarPapel).toHaveBeenCalledWith("headline", "Kefir");
  });

  it("cai no nome do arquivo quando o slot está vazio", async () => {
    const usuario = userEvent.setup();
    const { aoMudarPapel } = montar({ headline: "", body: "" });

    const arquivo = new File([new Uint8Array([0, 1, 0, 0])], "Kefir-Regular.woff2");
    await usuario.upload(screen.getByLabelText("Enviar arquivo da fonte de destaque"), arquivo);

    expect(aoMudarPapel).toHaveBeenCalledWith("headline", "Kefir Regular");
  });

  it("abre o campo de nome atrás de corrigir, que é o caminho secundário", async () => {
    const usuario = userEvent.setup();
    montar({ headline: "Kefir", body: "Commissioner" });

    await usuario.click(screen.getAllByRole("button", { name: "corrigir nome" })[0]);
    expect(screen.getByLabelText("Fonte de destaque")).toBeTruthy();
  });

  it("cai no campo quando a leitura não achou família nenhuma", () => {
    montar({ headline: "", body: "" });

    expect(screen.getByLabelText("Fonte de destaque")).toBeTruthy();
    expect(screen.getByLabelText("Fonte de texto")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "corrigir nome" })).toBeNull();
  });
});

/**
 * Marca sem tipografia declarada.
 *
 * `typography` é jsonb e nasce `{}` quando a leitura não achou família nenhuma
 * ou quando a marca foi criada à mão. Ler `.trim()` de `undefined` derrubava a
 * aba Visual inteira em Minha Marca, e com ela as cores, o logo e as fontes:
 * tela branca com "Unexpected Application Error".
 */
describe("tipografia ausente", () => {
  it("renderiza sem quebrar quando a marca não tem tipografia", () => {
    const vazia = {} as { headline: string; body: string };
    expect(() =>
      render(
        <ListaDeFontes
          fontes={[]}
          tipografia={vazia}
          aoMudarPapel={() => {}}
          aoEnviar={async () => {}}
          aoRemover={() => {}}
        />,
      ),
    ).not.toThrow();

    expect(screen.getByLabelText("Fonte de destaque")).toBeTruthy();
  });
});
