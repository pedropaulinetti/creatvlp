import * as React from "react";
import { callFunction, streamFunction, functionErrorMessage, type EtapaFuncao } from "@/lib/functions";
import { ETAPAS, leituraVazia, type EtapaChave, type Leitura, type RespostaAnalise } from "./tipos";

/**
 * Intervalo mínimo entre duas etapas na tela.
 *
 * O servidor termina várias delas quase juntas — ler o CSS e classificar cores
 * leva milissegundos. Sem espaçar, três etapas piscam no mesmo quadro e a
 * pessoa não vê nada acontecer.
 */
const RITMO_MS = 300;

/** Depois disso sem nenhum evento, assumimos que não há stream nesta conexão. */
const ESPERA_POR_STREAM_MS = 700;

/** Ritmo do avanço estimado, quando não há stream para seguir. */
const ESTIMATIVA_MS = 1100;

/**
 * Lê o site e conta o que encontra, no ritmo em que encontra.
 *
 * A função devolve as etapas por SSE. Se o stream falhar — proxy que não deixa
 * passar, função ainda não publicada, rede que cai no meio — a mesma chamada é
 * refeita em modo JSON: o resultado é idêntico, só chega de uma vez.
 *
 * Sem stream, as etapas ainda avançam na tela, mas só até "lendo": marcar como
 * concluído o que não se viu concluir seria inventar progresso. O que já foi
 * encontrado só aparece quando existe resposta para mostrar.
 */
export function useLeituraDoSite(opcoes: { workspaceId: string | null; brandId: string }) {
  const [leitura, setLeitura] = React.useState<Leitura>(leituraVazia);
  const [lendo, setLendo] = React.useState(false);
  const [erro, setErro] = React.useState("");

  const fila = React.useRef<EtapaFuncao[]>([]);
  const temporizador = React.useRef<number | null>(null);
  const viuEvento = React.useRef(false);

  const parar = React.useCallback(() => {
    if (temporizador.current !== null) {
      window.clearInterval(temporizador.current);
      temporizador.current = null;
    }
  }, []);

  React.useEffect(() => parar, [parar]);

  /** Esvazia a fila de eventos, um a cada RITMO_MS. */
  const escoar = React.useCallback(() => {
    if (temporizador.current !== null) return;
    temporizador.current = window.setInterval(() => {
      const proximo = fila.current.shift();
      if (!proximo) {
        parar();
        return;
      }
      setLeitura((atual) => reduzir(atual, proximo));
    }, RITMO_MS);
  }, [parar]);

  const enfileirar = React.useCallback(
    (etapa: EtapaFuncao) => {
      if (!viuEvento.current) {
        viuEvento.current = true;
        parar(); // o avanço estimado dá lugar ao que o servidor está contando
        setLeitura((atual) => ({ ...atual, aoVivo: true }));
      }
      fila.current.push(etapa);
      escoar();
    },
    [escoar, parar],
  );

  /** Avanço honesto de quem não tem stream: mostra o que está sendo feito, não o resultado. */
  const estimar = React.useCallback(() => {
    if (viuEvento.current || temporizador.current !== null) return;
    temporizador.current = window.setInterval(() => {
      setLeitura((atual) => {
        const proxima = ETAPAS.find((item) => atual.estados[item.chave] === "esperando");
        if (!proxima) return atual;
        const estados = { ...atual.estados };
        // A anterior sai de "lendo" só quando a resposta chegar.
        estados[proxima.chave] = "lendo";
        return { ...atual, estados };
      });
    }, ESTIMATIVA_MS);
  }, []);

  const ler = React.useCallback(
    async (url: string): Promise<RespostaAnalise | null> => {
      if (!opcoes.workspaceId) {
        // Voltar em silêncio para a tela do endereço faz o botão parecer morto.
        setErro("Ainda estamos preparando sua conta. Tente de novo em um instante.");
        return null;
      }
      const corpo = { workspace_id: opcoes.workspaceId, url, brand_id: opcoes.brandId };

      parar();
      fila.current = [];
      viuEvento.current = false;
      setLendo(true);
      setErro("");
      setLeitura({ ...leituraVazia(), url, estados: { ...leituraVazia().estados, pagina: "lendo" } });

      const semStream = window.setTimeout(estimar, ESPERA_POR_STREAM_MS);

      try {
        let resposta: RespostaAnalise;
        try {
          resposta = await streamFunction<RespostaAnalise>("analyze-brand", corpo, enfileirar);
        } catch (falhaStream) {
          // Erro de autenticação, quota ou conteúdo não melhora sem stream.
          if (!ehFalhaDeTransporte(falhaStream)) throw falhaStream;
          resposta = await callFunction<RespostaAnalise>("analyze-brand", corpo);
        }

        // A fila pode ter eventos por mostrar: eles são o que a pessoa veio ver.
        await esvaziada(fila, RITMO_MS);
        setLeitura((atual) => comResposta(atual, resposta));
        return resposta;
      } catch (falha) {
        setErro(functionErrorMessage(falha));
        return null;
      } finally {
        window.clearTimeout(semStream);
        parar();
        setLendo(false);
      }
    },
    [enfileirar, estimar, opcoes.brandId, opcoes.workspaceId, parar],
  );

  return { leitura, lendo, erro, setErro, ler };
}

/** Espera a fila de etapas terminar de aparecer, com teto para não travar. */
async function esvaziada(fila: React.RefObject<EtapaFuncao[]>, ritmo: number) {
  const limite = Date.now() + 4000;
  while ((fila.current?.length ?? 0) > 0 && Date.now() < limite) {
    await new Promise((resolve) => window.setTimeout(resolve, ritmo));
  }
}

/** Só a falha do canal justifica repetir a chamada; a do conteúdo, não. */
function ehFalhaDeTransporte(falha: unknown): boolean {
  const code = (falha as { code?: string })?.code;
  return code === "falha_rede" || code === "stream_incompleto" || code === undefined;
}

type Dados = Record<string, unknown>;

function reduzir(atual: Leitura, { etapa, estado, dados }: EtapaFuncao): Leitura {
  const chave = etapa as EtapaChave;
  if (!ETAPAS.some((item) => item.chave === chave)) return atual;

  const estados = { ...atual.estados, [chave]: estado };
  const proxima = { ...atual, estados };
  if (estado === "lendo" || !dados) return proxima;

  const d = dados as Dados;
  switch (chave) {
    case "pagina":
      return { ...proxima, url: String(d.url ?? atual.url), titulo: String(d.titulo ?? "") };
    case "navegacao":
      return { ...proxima, paginas: (d.paginas as string[]) ?? [] };
    case "estilos":
      return { ...proxima, folhas: Number(d.folhas ?? 0) };
    case "paleta":
      return { ...proxima, cores: (d.cores as Leitura["cores"]) ?? atual.cores };
    case "tipografia": {
      const fonts = d.fonts as { headline?: string; body?: string } | undefined;
      return { ...proxima, fontes: { headline: fonts?.headline ?? "", body: fonts?.body ?? "" } };
    }
    case "logo": {
      const logo = d.logo as { url?: string } | null | undefined;
      return {
        ...proxima,
        logoUrl: logo?.url ?? atual.logoUrl,
        logoPath: (d.logo_path as string | null) ?? atual.logoPath,
      };
    }
    case "referencias":
      return {
        ...proxima,
        imagens: (d.imagens as string[]) ?? atual.imagens,
        referencias: Number(d.guardadas ?? atual.referencias),
      };
    case "catalogo":
      return {
        ...proxima,
        produtos: (d.produtos as Leitura["produtos"]) ?? [],
        moeda: String(d.moeda ?? atual.moeda),
        loja: Array.isArray(d.produtos) && d.produtos.length > 0,
      };
    case "texto":
      return { ...proxima, textoOk: !d.indisponivel };
    default:
      return proxima;
  }
}

/**
 * Fecha a leitura com o payload completo.
 *
 * Sem stream nada foi anunciado no caminho, então é aqui que a tela ganha
 * tudo de uma vez — e o resultado fica idêntico ao do caminho animado.
 */
function comResposta(atual: Leitura, resposta: RespostaAnalise): Leitura {
  const ds = resposta.design_system;
  const loja = resposta.catalog ?? resposta.shopify;

  return {
    ...atual,
    estados: Object.fromEntries(ETAPAS.map((item) => [item.chave, "feito"])) as Leitura["estados"],
    folhas: ds?.stylesheets ?? atual.folhas,
    cores: ds?.colors.length ? ds.colors : resposta.analysis.colors,
    fontes: ds?.fonts.headline || ds?.fonts.body
      ? { headline: ds.fonts.headline, body: ds.fonts.body }
      : atual.fontes,
    logoPath: ds?.logo_path ?? atual.logoPath,
    logoUrl: ds?.logo?.url ?? atual.logoUrl,
    paginas: resposta.pages?.slice(1) ?? atual.paginas,
    imagens: ds?.images?.length ? ds.images : atual.imagens,
    referencias: ds?.reference_paths?.length ?? atual.referencias,
    produtos: loja?.products ?? atual.produtos,
    moeda: loja?.currency || atual.moeda,
    loja: Boolean(loja?.products.length) || atual.loja,
    textoOk: resposta.text_analysis?.ok ?? atual.textoOk,
    confianca: resposta.analysis.confidence,
    /*
     * `reference_paths` não existe na versão anterior da função. Sem esse
     * campo, o que está publicado é código antigo — e nenhuma correção de
     * paleta, logo ou imagem chegou ao ar, por mais que o app esteja atualizado.
     */
    funcaoAtual: !ds || Array.isArray(ds.reference_paths),
  };
}

/**
 * A leitura valeu a pena?
 *
 * Sem cor, sem tipografia e sem catálogo não há o que confirmar — insistir na
 * leitura só faz perder tempo, e a conversa resolve melhor.
 */
export function respostaRendeu(resposta: RespostaAnalise): boolean {
  const ds = resposta.design_system;
  return (
    (ds?.colors.length ?? 0) > 0 ||
    Boolean(ds?.fonts.headline || ds?.fonts.body) ||
    ((resposta.catalog ?? resposta.shopify)?.products.length ?? 0) > 0
  );
}
