import type { Brief } from "./schemas.ts";

export type BrandMemory = {
  name: string;
  description: string | null;
  website: string | null;
  segment: string | null;
  voice_tone: string | null;
  voice_notes: string | null;
  recommended_words: string[] | null;
  forbidden_words: string[] | null;
  forbidden_promises: string[] | null;
  differentiators: string[] | null;
  competitors: unknown;
  proofs: unknown;
  recurring_offers: unknown;
  colors: unknown;
  /** Marca criada antes da leitura de tipografia não tem esse campo. */
  typography?: unknown;
  channels: string[] | null;
  formats: string[] | null;
};

export type ProductMemory = { name: string; description: string | null; price_cents: number | null; highlights: string[] | null };
export type AudienceMemory = { name: string; description: string | null; pains: string[] | null; desires: string[] | null; objections: string[] | null };
export type LearningMemory = { kind: string; statement: string; confidence: string };

const list = (values: unknown, empty = "não informado"): string => {
  if (!Array.isArray(values) || values.length === 0) return empty;
  return values
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        // Cobre os formatos usados na memória da marca: concorrentes {name,note},
        // provas {statement,source}, ofertas {name,detail} e cores {hex,label}.
        return [record.name, record.statement, record.label, record.hex, record.detail, record.note, record.source]
          .filter(Boolean)
          .join(" — ");
      }
      return String(item);
    })
    .filter(Boolean)
    .join("; ");
};

/** Bloco de memória de marca reaproveitado por todas as chamadas de IA. */
export function brandContext(
  brand: BrandMemory,
  products: ProductMemory[] = [],
  audiences: AudienceMemory[] = [],
  learnings: LearningMemory[] = [],
): string {
  const lines = [
    `Marca: ${brand.name}`,
    `Segmento: ${brand.segment || "não informado"}`,
    `Descrição: ${brand.description || "não informada"}`,
    `Site: ${brand.website || "não informado"}`,
    `Tom de voz: ${brand.voice_tone || "não definido"}${brand.voice_notes ? ` — ${brand.voice_notes}` : ""}`,
    `Diferenciais: ${list(brand.differentiators)}`,
    `Provas e credenciais: ${list(brand.proofs)}`,
    `Ofertas recorrentes: ${list(brand.recurring_offers)}`,
    `Concorrentes: ${list(brand.competitors)}`,
    `Canais habituais: ${list(brand.channels)}`,
    `Palavras recomendadas: ${list(brand.recommended_words)}`,
    `Palavras PROIBIDAS (nunca use): ${list(brand.forbidden_words, "nenhuma")}`,
    `Promessas PROIBIDAS (nunca prometa): ${list(brand.forbidden_promises, "nenhuma")}`,
  ];

  if (products.length) {
    lines.push(
      "Produtos:",
      ...products.slice(0, 12).map(
        (product) =>
          `  - ${product.name}${product.price_cents ? ` (R$ ${(product.price_cents / 100).toFixed(2)})` : ""}: ` +
          `${product.description || "sem descrição"}${product.highlights?.length ? ` | destaques: ${product.highlights.join(", ")}` : ""}`,
      ),
    );
  }

  if (audiences.length) {
    lines.push(
      "Públicos:",
      ...audiences.slice(0, 6).map(
        (audience) =>
          `  - ${audience.name}: ${audience.description || "sem descrição"}` +
          ` | dores: ${list(audience.pains, "não mapeadas")}` +
          ` | desejos: ${list(audience.desires, "não mapeados")}` +
          ` | objeções: ${list(audience.objections, "não mapeadas")}`,
      ),
    );
  }

  if (learnings.length) {
    lines.push(
      "Aprendizados de campanhas anteriores (sinais, não verdades):",
      ...learnings.slice(0, 10).map((item) => `  - [${item.kind}/${item.confidence}] ${item.statement}`),
    );
  }

  return lines.join("\n");
}

export const SYSTEM_BASE =
  "Você é o estrategista criativo do CreatvOS, um sistema brasileiro de produção e aprendizado criativo. " +
  "Escreve sempre em português do Brasil, com linguagem concreta e sem jargão de agência. " +
  "Respeita rigorosamente as palavras e promessas proibidas da marca. " +
  "Nunca inventa dado, número, prêmio, depoimento ou selo que não esteja na memória da marca. " +
  "Responde exclusivamente com JSON válido, sem markdown e sem comentários.";

export function chatSystemPrompt(context: string): string {
  return `${SYSTEM_BASE}

Sua tarefa nesta etapa: transformar o pedido do usuário em um briefing estruturado de campanha.

Regras:
- Use a memória da marca abaixo como fonte de verdade. Não peça o que já está nela.
- Se faltar informação essencial (produto, objetivo, oferta, canal, formato ou quantidade), faça no máximo 3 perguntas curtas e objetivas, e deixe "brief" como null e "ready" como false.
- **Toda pergunta vem com 2 a 4 respostas prontas em "options"**, tiradas da memória da marca: os produtos que ela vende, os públicos cadastrados, os canais e formatos que ela usa. Pergunta sobre produto lista os produtos reais pelo nome; sobre público, os públicos reais. Nunca invente opção que não venha da memória ou do que o usuário já disse.
- Se a pergunta for realmente aberta e não houver nada na memória para sugerir, devolva "options" vazio. É melhor não sugerir do que sugerir palpite.
- As opções são atalho, não camisa de força: o usuário sempre pode escrever outra coisa.
- Quando tiver o suficiente, preencha "brief" completo e marque "ready" como true. Preencha campos ausentes com o padrão mais sensato da marca, dizendo isso em "reply".
- "quantity" é o número de peças e nunca passa de 30.
- "formats" usa apenas "4:5", "1:1" e "9:16".
- Em "reply", fale com o usuário em no máximo 3 frases, sem repetir o briefing item a item.

Formato da resposta (JSON):
{"reply": string, "questions": [{"question": string, "options": string[]}], "brief": objeto-do-briefing ou null, "ready": boolean}

MEMÓRIA DA MARCA
${context}`;
}

export function directionsPrompt(context: string, brief: Brief, count: number): string {
  return `${SYSTEM_BASE}

Sua tarefa: propor ${count} caminhos criativos distintos para a campanha abaixo. Cada caminho testa uma hipótese diferente — não são variações do mesmo argumento.

Só os caminhos: as copies de cada um são escritas depois, numa chamada própria.

Regras:
- Cada caminho precisa de: name, hypothesis, problem, promise, hook, mechanism, proof, objection, cta, visual_prompt e rationale.
- "proof" só pode citar provas que estejam na memória da marca. Se não houver, escreva "".
- "visual_prompt" descreve o ANÚNCIO INTEIRO, não só uma fotografia de fundo: a cena, como o produto aparece, o clima e o tratamento visual. Escreva em português, com 2 a 4 frases concretas.
- Escreva o "visual_prompt" AMPLO o bastante para caber em layouts muito diferentes — de um fundo de cor sólida com o produto recortado a uma fotografia ocupando a peça inteira. Descreva o assunto e o clima, não a diagramação: nada de dizer onde fica o título, quantas colunas tem ou o que vai no rodapé, porque isso muda a cada peça.
- NÃO escreva dentro do "visual_prompt" o texto do anúncio — headline, preço, selo ou CTA. As palavras da peça são escritas depois, na etapa de copy.
- "hook" tem no máximo 160 caracteres e funciona como primeira linha do anúncio.
- NÃO escreva copies aqui. Elas são pedidas depois, uma chamada por caminho.
- "rationale" explica em uma frase por que vale testar este caminho.

Formato da resposta (JSON):
{"directions": [{"name","hypothesis","problem","promise","hook","mechanism","proof","objection","cta","visual_prompt","rationale"}]}

BRIEFING
${JSON.stringify(brief, null, 2)}

MEMÓRIA DA MARCA
${context}`;
}

export function copiesPrompt(context: string, brief: Brief, direction: Record<string, unknown>, count: number): string {
  return `${SYSTEM_BASE}

Sua tarefa: escrever ${count} variações de copy para o caminho criativo abaixo, mantendo o mesmo ângulo e mudando **a forma do anúncio**, não só as palavras.

Cada variação nasce para um formato diferente, nesta ordem:
1. "titulo" — o anúncio clássico: título, apoio e botão.
2. "enquete" — uma pergunta escrita à mão num quadro, com 3 respostas e quantas
   pessoas marcaram cada uma. NÃO tem título nem apoio: a pergunta é o anúncio.
   Preencha "pergunta" (até 120 caracteres) e "opcoes" — cada resposta com até
   40 caracteres e "votos" plausíveis, somando poucas dezenas —, e deixe
   headline e subheadline vazias.
3. "conversa" — um print de mensagens entre um cliente e a marca, 3 a 4 balões,
   como gente escreve mesmo. NÃO tem título nem apoio. Preencha "mensagens" —
   cada balão com até 140 caracteres, que é o que cabe na tela —, e deixe
   headline e subheadline vazias.

Se ${count} for menor que 3, use os formatos nesta ordem a partir do primeiro.

Regras:
- headline com até 120 caracteres, subheadline com até 160, body com até 600.
- Devolva TODOS os campos, e nunca com "null": campo de texto que este formato
  não usa vem como "" e lista que ele não usa vem como []. Um "null" derruba a
  resposta inteira.
- Mantenha o CTA coerente com o objetivo "${brief.objective}".
- Respeite as palavras e promessas proibidas da marca.
- Na headline, marque UM termo com *asteriscos* — o que carrega o argumento, não
  o nome da marca. Ele sai na cor de acento. Exemplo: "Seu merino passou por um
  *banho químico*". Se nenhuma palavra se destacar de verdade, não marque nada.
- "bullets": 3 itens curtos, de até 70 caracteres, na mesma ordem de leitura —
  benefícios, sinais ou números que sustentem a headline. São eles que preenchem
  os formatos de lista e de prova. Só use fato que esteja no contexto; sem fato,
  devolva lista vazia. Número vem primeiro no item ("94% recomendam"), porque é
  ele que o formato de prova destaca.

- Em "enquete" e "conversa", o "cta" continua obrigatório: é o que vai no botão.
- A conversa não pode inventar elogio de cliente que a marca não tenha. Escreva
  a dúvida real de quem está decidindo comprar, e a resposta que a marca daria.

Formato da resposta (JSON): {"copies": [{"formato": "titulo"|"enquete"|"conversa", "headline": string, "subheadline": string, "body": string, "cta": string, "bullets": string[], "pergunta": string, "opcoes": [{"texto": string, "votos": number}], "mensagens": [{"de": "pessoa"|"marca", "texto": string}]}]}

CAMINHO CRIATIVO
${JSON.stringify(direction, null, 2)}

BRIEFING
${JSON.stringify(brief, null, 2)}

MEMÓRIA DA MARCA
${context}`;
}

/**
 * Prompt da imagem-base. Descreve cena; o CreatvOS compõe texto e identidade depois.
 * O reforço negativo é explícito porque modelos tendem a inserir texto sozinhos.
 */
/**
 * O prompt da imagem-base.
 *
 * Com referências, o pedido muda de natureza: em vez de inventar uma cena
 * genérica, o modelo tem de mostrar **aquele** produto, com a etiqueta, a cor e
 * o formato que ele tem de verdade. Sem isso a peça saía com uma foto de banco
 * de imagens que não é o que a marca vende — que era a queixa.
 */
export function imagePrompt(
  visualPrompt: string,
  brand: BrandMemory,
  format: string,
  referencias: { produto: boolean; estilo: number } = { produto: false, estilo: 0 },
): string {
  const ratio = format === "9:16" ? "vertical 9:16" : format === "1:1" ? "quadrado 1:1" : "vertical 4:5";
  return [
    `Fotografia publicitária ${ratio} para a marca ${brand.name}${brand.segment ? ` (${brand.segment})` : ""}.`,
    visualPrompt,
    referencias.produto
      ? "A primeira imagem de referência é o produto real desta marca: reproduza-o com fidelidade — mesma forma, mesma cor, mesmos detalhes de acabamento — como objeto principal da cena. Não invente outro produto nem altere a embalagem."
      : "",
    referencias.estilo > 0
      ? "As demais imagens de referência mostram como esta marca se fotografa: siga a mesma direção de luz, paleta e clima. Não as copie nem reproduza pessoas que apareçam nelas."
      : "",
    /*
     * A mesma fotografia vira três peças, com o texto em lugares diferentes.
     * Sem pedir enquadramento tolerante, um layout encaixa e os outros dois
     * cortam o produto ou jogam a headline em cima do assunto.
     */
    "Enquadramento tolerante a recorte: o assunto centralizado e inteiro, com folga limpa em cima e embaixo, e nada essencial nos 15% das bordas. A mesma fotografia vai ser usada com o texto no rodapé, no topo e recortada em quadrado.",
    // Pedir "área limpa" faz o modelo pintar um bloco chapado com borda dura.
    // O que se quer é espaço negativo dentro da própria cena.
    "Enquadramento com espaço negativo natural na parte superior — parede, céu, superfície ou fundo desfocado — onde depois entra o texto.",
    "A fotografia preenche o quadro inteiro, de borda a borda, sem faixas, molduras, bordas brancas ou blocos de cor chapada.",
    "Iluminação natural, cores fiéis, acabamento editorial, alta nitidez.",
    /*
     * Texto, logo e preço são compostos depois, de forma determinística: o que
     * o modelo escreve na imagem sai torto e não dá para corrigir.
     *
     * Com a foto do produto anexada, porém, a proibição não pode ser cega. O
     * rótulo é parte do objeto — mandar "nenhuma letra" com uma embalagem
     * rotulada na referência é dar uma ordem impossível, e o modelo resolve
     * inventando rabisco em forma de letra no lugar do rótulo. Foi isso que
     * saiu ilegível nas garrafas. A regra passa a separar o que é reproduzir
     * do que é acrescentar.
     */
    referencias.produto
      ? "IMPORTANTE: o rótulo faz parte do produto — reproduza-o exatamente como está na foto de referência: mesmas palavras, mesma tipografia, mesmas cores, mesma posição na embalagem, nítido e legível. Não o apague, não o borre, não o traduza nem invente letras no lugar dele. Fora o rótulo do próprio produto, a imagem não pode conter nenhum texto, número, logotipo, marca d'água, etiqueta de preço, selo, botão ou interface. Apenas a cena fotográfica."
      : "IMPORTANTE: a imagem não pode conter nenhum texto, letra, número, palavra, logotipo, marca d'água, etiqueta de preço, selo, botão ou interface. Apenas a cena fotográfica.",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * A peça inteira desenhada pelo modelo, texto incluído.
 *
 * Caminho paralelo ao da composição em HTML, não substituto: aqui o modelo
 * desenha o anúncio completo seguindo o arquétipo, e o resultado tem a liberdade
 * gráfica das referências — recorte, selo, balão, seta. Em troca, o texto pode
 * sair com erro de ortografia e não é editável depois. Por isso as duas versões
 * convivem e quem escolhe é quem vai publicar.
 */
export function pecaCompletaPrompt(
  peca: {
    /*
     * A estrutura a seguir, em palavras. Vem do acervo de referências reais e
     * costuma ser vazia: a imagem da referência vai anexada ao prompt e diz
     * mais do que qualquer descrição. Vazia sem referência anexada, cai numa
     * das formas escritas à mão abaixo.
     */
    estrutura: string;
    /** Se uma referência de layout foi anexada como imagem a esta chamada. */
    temReferencia?: boolean;
    /** Idem, vindo de `anexos`. Mantido separado para não quebrar chamadas antigas. */
    layoutAnexado?: boolean;
    /*
     * A cena proposta pelo caminho criativo.
     *
     * Ficava só gravada na linha do criativo e nunca chegava ao modelo: a peça
     * saía desenhada sem nenhuma direção de cena, o que tornava o caminho
     * criativo decorativo. É ele que diferencia uma hipótese da outra.
     */
    cena?: string;
    headline: string;
    subheadline: string;
    cta: string;
    price: string;
    bullets: string[];
    palette: { ink: string; surface: string; accent: string };
    typography: { headline: string; body: string };
    format: string;
  },
  brand: BrandMemory,
  /*
   * O que foi anexado, na ordem exata em que vai no corpo da chamada.
   *
   * Sem isto o prompt falava em "a imagem de referência anexada" no singular e
   * o modelo aplicava a frase à primeira imagem — que é a foto do produto. O
   * resultado era o produto sendo tratado como referência de layout, redesenhado
   * em vez de reproduzido. Cada imagem precisa ser endereçada pela posição.
   */
  anexos: { anterior?: boolean; produto: boolean; layout: boolean; estilo: number } = {
    produto: false,
    layout: false,
    estilo: 0,
  },
): string {
  const proporcao = peca.format === "9:16" ? "9:16 vertical" : peca.format === "1:1" ? "1:1 quadrado" : "4:5 vertical";

  // "primeira", "segunda"… conforme o que veio antes.
  const ORDINAL = ["primeira", "segunda", "terceira", "quarta"];
  let posicao = 0;
  const proxima = () => ORDINAL[posicao++] ?? "próxima";

  const FORMA: Record<string, string> = {
    bloco:
      "Fundo de cor sólida ocupando a peça inteira. Título gigantesco em caixa alta no topo, ocupando um terço da altura. Abaixo, uma lista curta com marcadores de visto. No rodapé, a foto do produto num recorte de cantos arredondados e, embaixo dela, um botão em pílula.",
    listicle:
      "Fotografia escurecida ao fundo. Título no topo e, abaixo, itens numerados em círculos coloridos, um por linha, alinhados à esquerda. Botão em pílula no rodapé.",
    manchete:
      "Formato de notícia: faixa colorida com uma palavra em caixa alta no topo, manchete em tipografia editorial logo abaixo, fotografia ocupando o meio da peça e uma linha de legenda no rodapé.",
    numeros:
      "Título no topo. Abaixo, a foto do produto recortada à esquerda e, à direita, três números grandes empilhados, cada um com uma linha curta de explicação. Botão em pílula no rodapé.",
    destaque:
      "Fotografia ocupando a peça inteira, escurecida na metade de baixo. Título em caixa alta centralizado sobre ela, com uma expressão em cor de destaque. Botão em pílula centralizado no rodapé.",
  };

  const seguindoReferencia = Boolean(peca.temReferencia || peca.layoutAnexado || peca.estrutura);

  /*
   * Apoio e itens dizem a mesma coisa de dois jeitos, e mandar os dois faz o
   * modelo desenhar os dois — linha de apoio com os benefícios separados por
   * barra E as mesmas palavras de novo em etiquetas. Quando há itens, eles
   * substituem o apoio: lista lê melhor do que frase corrida numa peça.
   */
  const itens = peca.bullets.filter(Boolean).slice(0, 3);
  const apoio = itens.length ? "" : peca.subheadline;

  const daAnterior = anexos.anterior
    ? `A ${proxima()} imagem anexada é a versão anterior desta mesma peça. Mantenha o produto, a cena e a identidade que já estão nela; o que muda é o texto listado abaixo.`
    : "";

  const daFoto = anexos.produto
    ? `A ${proxima()} imagem anexada é a fotografia do produto real desta marca. Reproduza esse produto com fidelidade absoluta — mesma forma, mesma cor, mesma proporção, mesmo material, mesmo acabamento e o MESMO RÓTULO, com o logotipo e os dizeres que aparecem nele. É ele o objeto do anúncio: não o substitua, não o redesenhe, não deixe a embalagem em branco nem invente outro modelo.`
    : "";

  const doLayout = anexos.layout
    ? `A ${proxima()} imagem anexada é um anúncio de OUTRA empresa e serve apenas como referência de estrutura.`
    : "";

  const doEstilo = anexos.estilo > 0
    ? `${anexos.estilo === 1 ? `A ${proxima()} imagem anexada mostra` : `As demais imagens anexadas mostram`} como esta marca se fotografa: siga a mesma direção de luz, paleta e clima, sem copiar a cena nem reproduzir pessoas que apareçam nela.`
    : "";

  /*
   * Com referência anexada, a forma vem dela. Sem nenhuma — acervo ainda não
   * semeado — sorteia uma das escritas à mão: cair sempre em `destaque` era o
   * que fazia a campanha inteira sair com o mesmo layout.
   */
  const escritaAMao = Object.values(FORMA)[Math.floor(Math.random() * Object.keys(FORMA).length)];

  return [
    `Anúncio publicitário ${proporcao} pronto para publicar, da marca ${brand.name}.`,

    daAnterior,
    daFoto,
    doLayout,

    peca.cena ? `Cena e clima do anúncio: ${peca.cena}` : "",

    seguindoReferencia
      ? [
          anexos.layout
            ? "Dessa imagem de estrutura, aproveite só a ESTRUTURA:"
            : "Estrutura a seguir:",
          peca.estrutura,
          "Reproduza a arquitetura dela — a disposição dos blocos, a proporção entre título e imagem, o tipo de recorte e o lugar do botão.",
          /*
           * A referência é um anúncio de outra empresa. Sem esta linha o modelo
           * traz junto o logotipo e o texto dela, que é o pior resultado
           * possível: peça bonita e impublicável.
           */
          "NUNCA copie dela o logotipo, o nome da marca, o texto, o produto, as cores nem qualquer selo ou avaliação. Dela vem só a arquitetura visual; a marca, o produto, a paleta e o texto são os desta peça, listados abaixo.",
        ]
          .filter(Boolean)
          .join(" ")
      : escritaAMao,

    doEstilo,

    /*
     * A cor de acento precisa ser exigida como elemento, não só declarada como
     * paleta. Medido: pedindo só "a paleta é esta", o modelo entregou a peça
     * inteira em branco no preto e ignorou o laranja da marca.
     */
    `Paleta: ${peca.palette.ink} como fundo escuro e ${peca.palette.surface} como cor clara.`,
    `OBRIGATÓRIO: a cor ${peca.palette.accent} tem de aparecer em destaque na peça — no botão, no preço ou numa palavra do título. Sem ela a peça não serve, porque é a cor da marca.`,
    `Tipografia sem serifa geométrica, próxima de ${peca.typography.headline}.`,
    "",
    "TEXTO — a peça contém estes blocos e NADA ALÉM DELES. Escreva exatamente assim, em português do Brasil, sem alterar, traduzir, abreviar ou acrescentar palavra nenhuma:",
    `Título: ${peca.headline.replace(/\*/g, "")}`,
    apoio ? `Apoio: ${apoio}` : "",
    itens.length ? `Itens: ${itens.join(" | ")}` : "",
    peca.price ? `Preço: ${peca.price}` : "",
    `Botão: ${peca.cta}`,
    /*
     * Sem esta linha o modelo espalha a mesma frase em três lugares: no apoio,
     * numa etiqueta flutuante e num balão. A peça fica ilegível de tanto texto
     * repetido — foi a queixa "por que tá com muito texto".
     */
    "Cada frase aparece UMA ÚNICA VEZ na peça. Não repita o título no apoio, não transforme os itens em etiquetas ou balões avulsos, não crie legenda, selo, carimbo, marca d'água nem texto decorativo de fundo. Menos texto e maior é sempre melhor do que mais texto e menor.",
    "",
    "A ortografia precisa estar perfeita, com todos os acentos. Não invente texto, selo, número, percentual, avaliação ou marca d'água que não esteja acima. Nada de texto decorativo ilegível de fundo.",
    /*
     * Duas regras opostas, e a diferença é quem escreveu o texto.
     *
     * Sem foto do produto, o modelo inventa a embalagem e rabisca marca falsa
     * nela — medido: saiu "moaoa STORE" na etiqueta de uma camiseta. Aí a
     * superfície tem de ser limpa.
     *
     * Com foto, a regra se inverte: o rótulo É o produto. Um condicionador com
     * rótulo apagado não é o produto da marca, é um frasco genérico — e mandar
     * "superfície limpa" junto de "reproduza com fidelidade" fazia o modelo
     * escolher a proibição e devolver a embalagem em branco.
     */
    anexos.produto
      ? "O rótulo faz parte do produto: reproduza o rótulo da foto exatamente como ele é — mesmo logotipo, mesmas palavras, mesma tipografia, mesmas cores e mesma posição na embalagem. Não o apague, não o deixe em branco, não o traduza nem o substitua por outro. O que é proibido é ACRESCENTAR ao produto qualquer texto, selo, etiqueta ou marca que não esteja na foto."
      : "O produto aparece sem nenhuma letra sobre ele: nada de etiqueta escrita, estampa, gravação ou logotipo no objeto. Superfície limpa.",
    "Acabamento de anúncio profissional: alto contraste entre texto e fundo, margens generosas, hierarquia clara.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function nextTestPrompt(context: string, reports: unknown, directions: unknown): string {
  return `${SYSTEM_BASE}

Sua tarefa: ler os resultados registrados manualmente e sugerir o próximo teste.

Regras de honestidade estatística:
- Com poucos dados, NUNCA afirme causalidade. Use "sinal observado" e "hipótese para o próximo teste".
- Se a amostra for insuficiente para alguma conclusão, escreva "" no campo correspondente e explique em "caveat".
- Não invente métrica que não esteja nos dados.

Formato (JSON): {"best_angle","best_hook","best_format","best_offer","learnings":string[],"next_test","caveat"}

RESULTADOS REGISTRADOS
${JSON.stringify(reports, null, 2)}

CAMINHOS TESTADOS
${JSON.stringify(directions, null, 2)}

MEMÓRIA DA MARCA
${context}`;
}

/**
 * Conversa de onboarding para quem não tem site — ou cujo site não deu leitura.
 *
 * A regra que mais importa é a de uma pergunta por vez: a alternativa a este
 * caminho era um formulário de oito etapas, e repetir isso em forma de chat
 * não resolveria nada.
 */
export function brandInterviewPrompt(): string {
  return `${SYSTEM_BASE}

Sua tarefa: montar a memória de uma marca conversando com a pessoa dona dela.

Regras:
- Extraia tudo o que já der para extrair do que foi dito. Não invente nada.
- Se algo não foi dito, devolva string vazia ou lista vazia.
- Faça no máximo UMA pergunta por vez, em "question", curta e em português.
- Pergunte só o essencial que ainda falta, nesta ordem: nome da marca, o que
  ela vende, para quem vende, como ela fala.
- Assim que tiver nome e ao menos um produto, marque "complete": true e deixe
  "question" vazia. O resto a pessoa completa depois, sozinha.
- Não peça cores nem tipografia: isso não se descreve por texto.
- "confidence" reflete o quanto a pessoa foi específica.

Formato (JSON): {"analysis":{"name","description","segment","voice_tone","colors":[],"products":[{"name","description"}],"audience","differentiators":string[],"confidence"},"question","complete"}`;
}

export function brandAnalysisPrompt(facts: Record<string, unknown>, url: string): string {
  return `${SYSTEM_BASE}

Sua tarefa: extrair informações de marca a partir do conteúdo público da página abaixo.

Regras:
- Use somente o que estiver no conteúdo. Não complete com suposições.
- Se algo não aparecer, devolva string vazia ou lista vazia.
- "confidence" reflete quão claro o conteúdo estava: "alta", "media" ou "baixa".
- Não invente cores: a paleta é extraída do CSS do site separadamente. Devolva [] em "colors".
- Se vierem "produtos_da_loja", eles são o catálogo real: use exatamente esses nomes.
- "outras_paginas" são páginas internas do mesmo site, lidas junto com a home.
  Elas valem tanto quanto ela — é ali que costuma estar o que a marca vende.
- "products" é o que a marca vende, seja lá a forma. Numa loja são os itens; num
  software são os planos e módulos; num serviço são os serviços prestados. Uma
  página que explica o que a empresa faz está listando o que ela vende — extraia
  daí, com o nome que a própria página usa. Só devolva [] quando a página
  realmente não disser o que é vendido.

Formato (JSON): {"name","description","segment","voice_tone","colors":[{"hex","role","label"}],"products":[{"name","description"}],"audience","differentiators":string[],"confidence"}

URL: ${url}

CONTEÚDO EXTRAÍDO
${JSON.stringify(facts, null, 2)}`;
}
