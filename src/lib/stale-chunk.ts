/**
 * Um deploy novo troca o hash dos arquivos em /assets. A aba que já estava aberta
 * segue com o index.html antigo e, ao entrar numa rota preguiçosa, pede um arquivo
 * que não existe mais. O navegador devolve "Failed to fetch dynamically imported
 * module" e o app quebra na cara de quem está usando.
 *
 * A saída é recarregar a página uma vez: o index.html novo aponta para os arquivos
 * novos e a navegação segue de onde parou.
 */

const RELOAD_KEY = "creatv:recarga-por-deploy";
const JANELA_MS = 15_000;

const PADROES = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed", // Safari
  "unable to preload css",
  "'text/html' is not a valid javascript mime type", // index.html devolvido no lugar do .js
];

export function ehArquivoDeDeployAntigo(erro: unknown): boolean {
  const mensagem = erro instanceof Error ? erro.message : String(erro ?? "");
  const normalizada = mensagem.toLowerCase();
  return PADROES.some((padrao) => normalizada.includes(padrao));
}

/**
 * Recarrega a página, no máximo uma vez a cada janela. Se o arquivo continuar
 * faltando depois da recarga, o erro sobe normalmente em vez de entrar em laço.
 */
export function recarregarPorDeploy(): boolean {
  try {
    const ultima = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (ultima && Date.now() - ultima < JANELA_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // sessionStorage bloqueado: recarrega assim mesmo, é melhor que a tela de erro.
  }
  window.location.reload();
  return true;
}
