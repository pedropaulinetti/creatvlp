/**
 * As sugestões que abrem a conversa de campanha.
 *
 * Eram três frases fixas — café especial, software, promoção da semana — que
 * não tinham nada a ver com quem estava lendo. Quem vende cosmético abria a
 * tela e via um exemplo sobre café: o sistema parecia não saber de que marca
 * estava falando, logo na primeira tela em que ele deveria provar que sabe.
 *
 * Tudo aqui sai da memória da marca: produtos do catálogo, ofertas recorrentes
 * e diferenciais, com a ocasião comercial mais próxima quando ela está perto o
 * bastante para valer uma campanha.
 */

export type FonteDeSugestao = {
  produtos: { name: string }[];
  /** Como estão gravadas na marca: `{name, detail}` ou texto solto. */
  ofertas: unknown;
  diferenciais: string[] | null;
  nomeDaMarca?: string | null;
};

type Ocasiao = { nome: string; mes: number; dia: number };

/*
 * O calendário comercial brasileiro que move verba de mídia. Não é exaustivo:
 * é o que faz alguém abrir o app para produzir criativo.
 */
const FIXAS: Ocasiao[] = [
  { nome: "Dia do Cliente", mes: 9, dia: 15 },
  { nome: "Dia das Crianças", mes: 10, dia: 12 },
  { nome: "Natal", mes: 12, dia: 25 },
  { nome: "Volta às aulas", mes: 2, dia: 1 },
  { nome: "Dia das Mulheres", mes: 3, dia: 8 },
  { nome: "Dia do Consumidor", mes: 3, dia: 15 },
  { nome: "Dia dos Namorados", mes: 6, dia: 12 },
];

/** O n-ésimo dia da semana de um mês: Dia das Mães e dos Pais são assim. */
function nEsimoDiaDaSemana(ano: number, mes: number, diaDaSemana: number, n: number): Date {
  const primeiro = new Date(ano, mes - 1, 1);
  const deslocamento = (diaDaSemana - primeiro.getDay() + 7) % 7;
  return new Date(ano, mes - 1, 1 + deslocamento + (n - 1) * 7);
}

/** A última sexta de novembro. */
function blackFriday(ano: number): Date {
  const ultimo = new Date(ano, 10, 30);
  return new Date(ano, 10, 30 - ((ultimo.getDay() - 5 + 7) % 7));
}

function calendarioDoAno(ano: number): { nome: string; data: Date }[] {
  return [
    ...FIXAS.map((item) => ({ nome: item.nome, data: new Date(ano, item.mes - 1, item.dia) })),
    { nome: "Dia das Mães", data: nEsimoDiaDaSemana(ano, 5, 0, 2) },
    { nome: "Dia dos Pais", data: nEsimoDiaDaSemana(ano, 8, 0, 2) },
    { nome: "Black Friday", data: blackFriday(ano) },
  ];
}

const DIA_EM_MS = 86_400_000;

/**
 * A próxima ocasião que ainda dá tempo de produzir.
 *
 * Menos de 3 dias não é campanha, é correria. Mais de 35 dias ainda não é
 * assunto — e como o calendário comercial brasileiro quase não tem buraco
 * maior que isso, uma janela larga faria TODA sugestão virar sazonal, com
 * "campanha de Natal" aparecendo em meados de outubro. Fora da janela a
 * sugestão fala do produto sem data.
 */
export function proximaOcasiao(hoje: Date): { nome: string; dias: number } | null {
  const candidatas = [...calendarioDoAno(hoje.getFullYear()), ...calendarioDoAno(hoje.getFullYear() + 1)]
    .map((item) => ({
      nome: item.nome,
      dias: Math.ceil((item.data.getTime() - hoje.getTime()) / DIA_EM_MS),
    }))
    .filter((item) => item.dias >= 3 && item.dias <= 35)
    .sort((a, b) => a.dias - b.dias);

  return candidatas[0] ?? null;
}

/** Ofertas ficam gravadas ora como objeto, ora como texto. Vale o que der nome. */
function nomeDaOferta(valor: unknown): string {
  if (typeof valor === "string") return valor.trim();
  if (valor && typeof valor === "object") {
    const item = valor as { name?: unknown; detail?: unknown };
    const nome = typeof item.name === "string" ? item.name.trim() : "";
    const detalhe = typeof item.detail === "string" ? item.detail.trim() : "";
    if (nome && detalhe) return `${nome} (${detalhe})`;
    return nome || detalhe;
  }
  return "";
}

/**
 * Até três aberturas de conversa, cada uma puxando de uma fonte diferente.
 *
 * Fontes diferentes de propósito: três frases sobre o mesmo produto não ajudam
 * ninguém a perceber o que dá para pedir.
 */
/**
 * O nome da marca como se fala dele.
 *
 * O que vem do onboarding costuma ser o título da página inicial do site —
 * "Leavo AI | Plataforma completa de vendas: IA no WhatsApp e CRM" — e enfiar
 * isso numa frase entrega uma sugestão que ninguém leria até o fim.
 */
export function nomeCurtoDaMarca(nome: string | null | undefined): string {
  const primeiro = (nome ?? "").split(/[|—–:·]/)[0].trim();
  if (!primeiro) return "";
  return primeiro.length > 40 ? `${primeiro.slice(0, 40).trimEnd()}…` : primeiro;
}

/**
 * Até três aberturas de conversa, cada uma puxando de uma fonte diferente.
 *
 * Fontes diferentes de propósito: três frases sobre o mesmo produto não ajudam
 * ninguém a perceber o que dá para pedir.
 */
export function sugestoesDeCampanha(fonte: FonteDeSugestao, hoje: Date = new Date()): string[] {
  const produtos = fonte.produtos.map((item) => item.name?.trim()).filter(Boolean) as string[];
  const ofertas = (Array.isArray(fonte.ofertas) ? fonte.ofertas : [])
    .map(nomeDaOferta)
    .filter(Boolean);
  const diferenciais = (fonte.diferenciais ?? []).map((item) => item?.trim()).filter(Boolean);

  const marca = nomeCurtoDaMarca(fonte.nomeDaMarca) || "a marca";
  const ocasiao = proximaOcasiao(hoje);
  const sugestoes: string[] = [];

  /*
   * A data entra uma vez só. Numa marca de um produto só, deixar a ocasião
   * livre fazia as duas primeiras sugestões dizerem a mesma coisa: "divulgar X
   * no Dia do Cliente" e "campanha de Dia do Cliente para a marca".
   */
  let ocasiaoUsada = false;

  if (produtos[0]) {
    sugestoes.push(
      ocasiao
        ? `Quero uma campanha para divulgar ${produtos[0]} no ${ocasiao.nome}.`
        : `Quero uma campanha para divulgar ${produtos[0]}.`,
    );
    ocasiaoUsada = Boolean(ocasiao);
  }

  if (ofertas[0]) sugestoes.push(`Crie anúncios para a oferta ${ofertas[0]}.`);

  // O segundo produto rende um pedido de forma diferente do primeiro.
  if (produtos[1]) sugestoes.push(`Preciso de 6 stories de ${produtos[1]} para esta semana.`);

  if (diferenciais[0]) sugestoes.push(`Crie anúncios destacando ${diferenciais[0].toLowerCase()}.`);

  /*
   * Marca de catálogo curto — ou recém-criada, sem catálogo nenhum — ainda
   * precisa de três pontos de partida. Nenhum deles inventa produto.
   */
  const reservas = [
    produtos[0] ? `Crie anúncios de ${produtos[0]} para quem ainda não conhece a marca.` : "",
    !ocasiaoUsada && ocasiao ? `Quero uma campanha de ${ocasiao.nome} para ${marca}.` : "",
    "Preciso de 6 stories para a promoção desta semana.",
    `Quero uma campanha de vendas para ${marca}.`,
  ].filter(Boolean);

  for (const reserva of reservas) {
    if (sugestoes.length >= 3) break;
    if (!sugestoes.includes(reserva)) sugestoes.push(reserva);
  }

  return sugestoes.slice(0, 3);
}
