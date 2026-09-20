/**
 * O nome da família de dentro do arquivo de fonte.
 *
 * O modelo de imagem desenha as letras, não renderiza um `.woff2` — o que ele
 * recebe é o NOME da família, naquela linha do prompt que pede "tipografia
 * próxima de X". Por isso o upload só vale a pena se dele sair o nome exato:
 * depender de alguém digitar "Poppins" sem errar é o que faz a peça sair com a
 * fonte errada.
 *
 * O nome vive na tabela `name` do formato SFNT, que é comum a TTF e OTF. WOFF
 * embrulha a mesma tabela com zlib, que o navegador sabe descomprimir. WOFF2
 * usa Brotli, que `DecompressionStream` não oferece — nesse caso devolvemos
 * null e a tela pede confirmação em vez de inventar.
 */

/** Nome preferido (id 16) antes do nome de família (id 1): é o sem o peso. */
const NOME_PREFERIDO = 16;
const NOME_DA_FAMILIA = 1;

function lerTabelaDeNomes(sfnt: DataView, inicio: number): string | null {
  if (inicio + 6 > sfnt.byteLength) return null;

  const quantidade = sfnt.getUint16(inicio + 2);
  const deslocamentoDasStrings = inicio + sfnt.getUint16(inicio + 4);

  let daFamilia: string | null = null;
  let preferido: string | null = null;

  for (let i = 0; i < quantidade; i += 1) {
    const registro = inicio + 6 + i * 12;
    if (registro + 12 > sfnt.byteLength) break;

    const plataforma = sfnt.getUint16(registro);
    const nomeId = sfnt.getUint16(registro + 6);
    if (nomeId !== NOME_DA_FAMILIA && nomeId !== NOME_PREFERIDO) continue;

    const bytes = sfnt.getUint16(registro + 8);
    const posicao = deslocamentoDasStrings + sfnt.getUint16(registro + 10);
    if (posicao + bytes > sfnt.byteLength) continue;

    const fatia = new Uint8Array(sfnt.buffer, sfnt.byteOffset + posicao, bytes);
    /*
     * Plataforma 1 é Macintosh e grava em ASCII de um byte; as demais gravam em
     * UTF-16BE. Ler tudo como UTF-16 devolve nome com espaço entre as letras.
     */
    const texto =
      plataforma === 1
        ? new TextDecoder("macintosh").decode(fatia)
        : new TextDecoder("utf-16be").decode(fatia);

    const limpo = texto.replace(/\0/g, "").trim();
    if (!limpo) continue;
    if (nomeId === NOME_PREFERIDO) preferido = preferido ?? limpo;
    else daFamilia = daFamilia ?? limpo;
  }

  return preferido ?? daFamilia;
}

/** Percorre o diretório SFNT até achar a tabela `name`. */
function nomeDoSfnt(dados: ArrayBuffer): string | null {
  const view = new DataView(dados);
  if (view.byteLength < 12) return null;

  const tabelas = view.getUint16(4);
  for (let i = 0; i < tabelas; i += 1) {
    const entrada = 12 + i * 16;
    if (entrada + 16 > view.byteLength) break;

    const etiqueta = String.fromCharCode(
      view.getUint8(entrada), view.getUint8(entrada + 1),
      view.getUint8(entrada + 2), view.getUint8(entrada + 3),
    );
    if (etiqueta !== "name") continue;

    return lerTabelaDeNomes(view, view.getUint32(entrada + 8));
  }

  return null;
}

/** WOFF guarda as mesmas tabelas, cada uma comprimida com zlib. */
async function nomeDoWoff(dados: ArrayBuffer): Promise<string | null> {
  const view = new DataView(dados);
  const tabelas = view.getUint16(12);

  for (let i = 0; i < tabelas; i += 1) {
    const entrada = 44 + i * 20;
    if (entrada + 20 > view.byteLength) break;

    const etiqueta = String.fromCharCode(
      view.getUint8(entrada), view.getUint8(entrada + 1),
      view.getUint8(entrada + 2), view.getUint8(entrada + 3),
    );
    if (etiqueta !== "name") continue;

    const posicao = view.getUint32(entrada + 4);
    const comprimido = view.getUint32(entrada + 8);
    const original = view.getUint32(entrada + 12);
    const bruto = dados.slice(posicao, posicao + comprimido);

    // Tabela não comprimida tem os dois tamanhos iguais.
    const tabela =
      comprimido === original
        ? bruto
        : await new Response(
            new Blob([bruto]).stream().pipeThrough(new DecompressionStream("deflate")),
          ).arrayBuffer();

    /*
     * A tabela `name` sozinha não é um SFNT: montamos um cabeçalho mínimo de
     * uma tabela só para reaproveitar o mesmo leitor.
     */
    const montado = new Uint8Array(12 + 16 + tabela.byteLength);
    const cabecalho = new DataView(montado.buffer);
    cabecalho.setUint32(0, 0x00010000);
    cabecalho.setUint16(4, 1);
    montado.set([0x6e, 0x61, 0x6d, 0x65], 12);
    cabecalho.setUint32(12 + 8, 28);
    cabecalho.setUint32(12 + 12, tabela.byteLength);
    montado.set(new Uint8Array(tabela), 28);

    return nomeDoSfnt(montado.buffer);
  }

  return null;
}

/**
 * O nome da família, quando o formato permite lê-lo.
 *
 * Devolve `null` para WOFF2 e para arquivo corrompido — a tela então pergunta
 * em vez de chutar, porque nome errado no prompt é peça com a fonte errada.
 */
export async function nomeDaFamilia(arquivo: File): Promise<string | null> {
  try {
    const dados = await arquivo.arrayBuffer();
    if (dados.byteLength < 16) return null;

    const assinatura = new DataView(dados).getUint32(0);
    // 'wOFF'
    if (assinatura === 0x774f4646) return await nomeDoWoff(dados);
    // 'wOF2' — Brotli, que o navegador não descomprime.
    if (assinatura === 0x774f4632) return null;

    return nomeDoSfnt(dados);
  } catch {
    return null;
  }
}

/** Um palpite a partir do nome do arquivo, para quando a leitura não vai. */
export function nomePeloArquivo(nomeDoArquivo: string): string {
  return nomeDoArquivo
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    // "PoppinsSemiBold" → "Poppins Semi Bold"
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}
