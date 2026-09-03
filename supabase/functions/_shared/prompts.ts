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
- Quando tiver o suficiente, preencha "brief" completo e marque "ready" como true. Preencha campos ausentes com o padrão mais sensato da marca, dizendo isso em "reply".
- "quantity" é o número de peças e nunca passa de 30.
- "formats" usa apenas "4:5", "1:1" e "9:16".
- Em "reply", fale com o usuário em no máximo 3 frases, sem repetir o briefing item a item.

Formato da resposta (JSON):
{"reply": string, "questions": string[], "brief": objeto-do-briefing ou null, "ready": boolean}

MEMÓRIA DA MARCA
${context}`;
}

export function directionsPrompt(context: string, brief: Brief, count: number): string {
  return `${SYSTEM_BASE}

Sua tarefa: propor ${count} caminhos criativos distintos para a campanha abaixo. Cada caminho testa uma hipótese diferente — não são variações do mesmo argumento.

Regras:
- Cada caminho precisa de: name, hypothesis, problem, promise, hook, mechanism, proof, objection, cta, visual_prompt, rationale e 3 copies.
- "proof" só pode citar provas que estejam na memória da marca. Se não houver, escreva "".
- "visual_prompt" descreve APENAS cena, fundo, luz, enquadramento, materiais e clima. É proibido pedir texto, headline, logotipo, preço, selo, botão ou CTA dentro da imagem — esses elementos são compostos depois pelo sistema. Escreva em português, com 2 a 4 frases concretas.
- "hook" tem no máximo 160 caracteres e funciona como primeira linha do anúncio.
- As 3 copies de cada caminho variam o mesmo ângulo, mudando abertura e ritmo.
- Cada item de "copies" é um objeto com EXATAMENTE estes campos:
  {"headline": string (até 120), "subheadline": string (até 160), "body": string (até 600), "cta": string (até 40)}
  O "cta" da copy é obrigatório e pode repetir o CTA do caminho.
- "rationale" explica em uma frase por que vale testar este caminho.

Formato da resposta (JSON):
{"directions": [{"name","hypothesis","problem","promise","hook","mechanism","proof","objection","cta","visual_prompt","rationale","copies":[{"headline","subheadline","body","cta"}]}]}

BRIEFING
${JSON.stringify(brief, null, 2)}

MEMÓRIA DA MARCA
${context}`;
}

export function copiesPrompt(context: string, brief: Brief, direction: Record<string, unknown>, count: number): string {
  return `${SYSTEM_BASE}

Sua tarefa: escrever ${count} variações de copy para o caminho criativo abaixo, mantendo o mesmo ângulo e mudando abertura, ritmo e ênfase.

Regras:
- headline com até 120 caracteres, subheadline com até 160, body com até 600.
- Mantenha o CTA coerente com o objetivo "${brief.objective}".
- Respeite as palavras e promessas proibidas da marca.

Formato da resposta (JSON): {"copies": [{"headline": string, "subheadline": string, "body": string, "cta": string}]}

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
export function imagePrompt(visualPrompt: string, brand: BrandMemory, format: string): string {
  const ratio = format === "9:16" ? "vertical 9:16" : format === "1:1" ? "quadrado 1:1" : "vertical 4:5";
  return [
    `Fotografia publicitária ${ratio} para a marca ${brand.name}${brand.segment ? ` (${brand.segment})` : ""}.`,
    visualPrompt,
    // Pedir "área limpa" faz o modelo pintar um bloco chapado com borda dura.
    // O que se quer é espaço negativo dentro da própria cena.
    "Enquadramento com espaço negativo natural na parte superior — parede, céu, superfície ou fundo desfocado — onde depois entra o texto.",
    "A fotografia preenche o quadro inteiro, de borda a borda, sem faixas, molduras, bordas brancas ou blocos de cor chapada.",
    "Iluminação natural, cores fiéis, acabamento editorial, alta nitidez.",
    "IMPORTANTE: a imagem não pode conter nenhum texto, letra, número, palavra, logotipo, marca d'água, etiqueta de preço, selo, botão ou interface. Apenas a cena fotográfica.",
  ].join(" ");
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

export function brandAnalysisPrompt(facts: Record<string, unknown>, url: string): string {
  return `${SYSTEM_BASE}

Sua tarefa: extrair informações de marca a partir do conteúdo público da página abaixo.

Regras:
- Use somente o que estiver no conteúdo. Não complete com suposições.
- Se algo não aparecer, devolva string vazia ou lista vazia.
- "confidence" reflete quão claro o conteúdo estava: "alta", "media" ou "baixa".
- Não invente cores: a paleta é extraída do CSS do site separadamente. Devolva [] em "colors".
- Se vierem "produtos_da_loja", eles são o catálogo real: use exatamente esses nomes.

Formato (JSON): {"name","description","segment","voice_tone","colors":[{"hex","role","label"}],"products":[{"name","description"}],"audience","differentiators":string[],"confidence"}

URL: ${url}

CONTEÚDO EXTRAÍDO
${JSON.stringify(facts, null, 2)}`;
}
