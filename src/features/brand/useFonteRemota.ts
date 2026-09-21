import * as React from "react";

/**
 * Carrega a família do Google Fonts, só para a prévia na tela.
 *
 * Serve às famílias conhecidas. Fonte própria da marca (Kefir, Haas) não está
 * lá, e para essas o que vale é o arquivo do site, guardado no nosso Storage.
 * Quando nem uma nem outra resolve, o link não carrega e a amostra fica na
 * fonte do app, sem tratamento extra.
 */
export function useFonteRemota(familia: string | null | undefined) {
  React.useEffect(() => {
    // Marca sem tipografia declarada é o caso comum, não o excepcional.
    const nome = (familia ?? "").trim();
    if (!nome || /^(inter|dm mono)$/i.test(nome)) return;

    const href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(nome).replace(/%20/g, "+")}&display=swap`;
    if (document.head.querySelector(`link[href="${CSS.escape(href)}"]`)) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.append(link);
  }, [familia]);
}
