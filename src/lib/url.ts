/**
 * Normalização de endereço digitado à mão.
 * Espelha `normalizeUrl` das Edge Functions — o servidor continua sendo quem
 * valida; aqui é para o campo mostrar o que de fato será lido.
 */
export function normalizeUrl(raw: string): string {
  let valor = raw.trim().replace(/^["'<]+|["'>]+$/g, "").trim();
  if (!valor) return "";

  valor = valor.replace(/^(https?):\/{1,}/i, "$1://").replace(/^(https?)\/{2}/i, "$1://");

  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(valor)) {
    if (/^[a-z][a-z0-9+.-]*:/i.test(valor)) return valor;
    valor = `https://${valor}`;
  }

  try {
    const url = new URL(valor);
    url.hostname = url.hostname.toLowerCase();
    url.hash = "";
    return url.toString();
  } catch {
    return valor;
  }
}

/** Parece um endereço utilizável? Usado para habilitar o botão. */
export function looksLikeUrl(raw: string): boolean {
  const normalizada = normalizeUrl(raw);
  if (!normalizada) return false;
  try {
    const url = new URL(normalizada);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      url.hostname.includes(".") &&
      url.hostname.length > 3
    );
  } catch {
    return false;
  }
}

/** Versão curta para exibir: sem esquema nem barra final. */
export function prettyUrl(raw: string): string {
  const normalizada = normalizeUrl(raw);
  return normalizada.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}
