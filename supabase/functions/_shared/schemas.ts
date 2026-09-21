import { z } from "npm:zod@3.23.8";

export const FORMATS = ["4:5", "1:1", "9:16"] as const;

export const briefSchema = z.object({
  campaign_name: z.string().trim().min(2),
  objective: z.string().trim().min(2),
  product: z.string().trim().min(1),
  audience: z.string().trim().min(1),
  offer: z.string().trim().default(""),
  channel: z.string().trim().min(1),
  formats: z.array(z.enum(FORMATS)).min(1),
  quantity: z.number().int().min(1).max(30),
  voice_tone: z.string().trim().default(""),
  restrictions: z.array(z.string().trim()).default([]),
  occasion: z.string().trim().default(""),
  occasion_date: z.string().trim().default(""),
  cta: z.string().trim().min(1),
  primary_metric: z.string().trim().min(1),
});

/**
 * Uma pergunta da entrevista de campanha, com respostas prontas para clicar.
 *
 * As opções saem da memória da marca — os produtos que ela vende de verdade, os
 * públicos que ela já cadastrou, os canais que ela usa. Perguntar "qual
 * produto?" e esperar digitação, tendo o catálogo em mãos, é jogar no usuário
 * um trabalho que o sistema já sabe fazer.
 *
 * Aceita também a forma antiga, só texto: conversa já gravada não pode quebrar.
 */
export const chatQuestionSchema = z.preprocess(
  (valor) => (typeof valor === "string" ? { question: valor, options: [] } : valor),
  z.object({
    question: z.string().trim().min(1).max(200),
    options: z.array(z.string().trim().min(1).max(80)).max(4).default([]),
  }),
);

export const chatTurnSchema = z.object({
  reply: z.string().trim().min(1),
  questions: z.array(chatQuestionSchema).max(3).default([]),
  brief: briefSchema.nullable().default(null),
  ready: z.boolean().default(false),
});

/**
 * Apara em vez de rejeitar.
 *
 * Estes tetos são de desenho: quanto de texto cabe num balão, numa etiqueta,
 * num título. Derrubar a geração inteira porque um balão veio com dez
 * caracteres a mais é desproporcional — o prompt já pede o limite, e o que
 * sobra ao schema é cortar a ponta, de preferência numa palavra inteira.
 */
const ateLimite = (limite: number, minimo = 0) =>
  z
    .string()
    .trim()
    .min(minimo)
    .transform((texto) => {
      if (texto.length <= limite) return texto;
      const cortado = texto.slice(0, limite);
      const espaco = cortado.lastIndexOf(" ");
      return (espaco > limite * 0.6 ? cortado.slice(0, espaco) : cortado).trimEnd();
    });

/**
 * `null` conta como campo ausente.
 *
 * `.default()` do zod só age sobre `undefined`. O modelo, mandado deixar vazio
 * o que o formato não usa, devolve `"pergunta": null` numa copy de título — e a
 * resposta inteira caía com `invalid_type`, derrubando a campanha por causa de
 * um campo que ninguém ia ler.
 */
const semNulo = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((valor) => (valor === null ? undefined : valor), schema);

/**
 * A estrutura da peça, escolhida por quem escreveu o texto.
 *
 * Era rodízio no servidor: variedade sim, intenção não. Quem acabou de
 * escrever "Qual seu maior desafio?" sabe que aquilo é enquete e que o título
 * não deve dominar; quem escreveu "13% mais volume" sabe o contrário.
 *
 * Quatro enums, e não layout livre. O canvas continua desenhando a letra, com
 * a ortografia impossível de errar; o que o modelo ganha é a arquitetura.
 * Valor fora do vocabulário cai no padrão em vez de derrubar a geração: o
 * modelo inventa nome de arquétipo de vez em quando, e isso não é motivo para
 * perder a campanha inteira.
 */
export const ARQUETIPOS_DA_COPY = [
  "vitrine", "coluna", "destaque", "bloco", "manchete", "listicle", "numeros", "enquete", "conversa",
] as const;

const enumTolerante = <T extends readonly [string, ...string[]]>(valores: T, padrao: T[number]) =>
  z.preprocess(
    (valor) => (typeof valor === "string" && (valores as readonly string[]).includes(valor) ? valor : padrao),
    z.enum(valores),
  );

export const layoutDaCopySchema = z.object({
  /** Vazio quando o modelo não escolheu: aí vale o rodízio do servidor. */
  arquetipo: z.preprocess(
    (valor) =>
      typeof valor === "string" && (ARQUETIPOS_DA_COPY as readonly string[]).includes(valor) ? valor : "",
    z.string(),
  ).default(""),
  /** Quanto o título manda na peça. */
  escala: enumTolerante(["dominante", "equilibrada", "discreta"] as const, "equilibrada").default("equilibrada"),
  alinhamento: enumTolerante(["esquerda", "centro"] as const, "esquerda").default("esquerda"),
  /** Onde o texto pousa no quadro. */
  ancora: enumTolerante(["topo", "rodape"] as const, "rodape").default("rodape"),
});

export type LayoutDaCopy = z.infer<typeof layoutDaCopySchema>;

const copyBase = z.object({
  /*
   * A headline pode marcar um termo com *asteriscos*: o renderizador o pinta na
   * cor de acento. É o destaque que aparece em quase todo anúncio bom, e fica
   * sob controle de quem escreve — não do renderizador adivinhando qual palavra
   * importa. Sem marca nenhuma, a headline sai inteira na mesma cor.
   */
  headline: semNulo(ateLimite(120).default("")),
  subheadline: semNulo(ateLimite(160).default("")),
  body: semNulo(ateLimite(600).default("")),
  cta: z.string().trim().min(1).max(40),
  /** Itens curtos para os arquétipos de lista e de números. */
  bullets: semNulo(z.array(ateLimite(70, 1)).max(5).default([])),

  /*
   * Formatos que não são título + apoio + botão.
   *
   * Anúncio bom nem sempre tem headline. A enquete é uma pergunta com respostas
   * riscadas num quadro; a conversa é um print de mensagens. Nesses, headline e
   * subheadline não existem — e enquanto a copy só sabia produzir título e
   * apoio, todo arquétipo acabava sendo o mesmo anúncio com outra moldura.
   *
   * Cada variação de copy nasce para um formato. Os campos que o formato não
   * usa vêm vazios, e é assim que se espera.
   */
  formato: semNulo(z.enum(["titulo", "enquete", "conversa"]).default("titulo")),

  /** Enquete: a pergunta e as respostas, com o quanto cada uma foi votada. */
  pergunta: semNulo(ateLimite(120).default("")),
  opcoes: semNulo(
    z
      .array(
        z.object({
          texto: ateLimite(40, 1),
          /*
           * Quantas pessoas marcaram essa resposta.
           *
           * O teto era 12 e derrubava a geração: enquete real tem dezenas de
           * votos, e o próprio prompt pede isso. O desenho é que se ajusta — ele
           * risca até um limite e escreve o número ao lado.
           */
          votos: semNulo(z.number().int().min(0).max(999).default(0)),
        }),
      )
      .max(3)
      .default([]),
  ),


  /*
   * A estrutura que esta copy pede. Ausente, o servidor decide por rodízio.
   */
  layout: semNulo(layoutDaCopySchema.default({})),

  /** Conversa: as mensagens, na ordem em que aparecem. */
  mensagens: semNulo(
    z
      .array(
        z.object({
          de: z.enum(["pessoa", "marca"]),
          // 140 é o que cabe no balão; o que passar disso é aparado, não rejeitado.
          texto: ateLimite(140, 1),
        }),
      )
      .max(5)
      .default([]),
  ),
});

/**
 * Dentro de um caminho, a copy pode não trazer CTA próprio — nesse caso ela
 * herda o CTA do caminho. Exigir o campo aqui só quebra a geração sem motivo.
 */
/**
 * Cada formato tem o seu conteúdo obrigatório.
 *
 * Exigir headline de todos era o que impedia enquete e conversa de existirem: o
 * modelo obedecia o prompt, devolvia headline vazia, e o schema rejeitava a
 * resposta inteira — derrubando a geração da campanha. Agora cada forma cobra o
 * que ela precisa para se desenhar, e só isso.
 */
function exigirConteudoDoFormato(
  copy: { formato: string; headline: string; pergunta: string; mensagens: unknown[] },
  ctx: z.RefinementCtx,
) {
  if (copy.formato === "titulo" && copy.headline.trim().length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["headline"], message: "Copy de título precisa de headline." });
  }
  if (copy.formato === "enquete" && copy.pergunta.trim().length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["pergunta"], message: "Enquete precisa da pergunta." });
  }
  if (copy.formato === "conversa" && copy.mensagens.length < 2) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["mensagens"], message: "Conversa precisa de ao menos dois balões." });
  }
}

export const copySchema = copyBase.superRefine(exigirConteudoDoFormato);

const directionCopySchema = copyBase
  .extend({ cta: z.string().trim().min(1).max(40).optional() })
  .superRefine(exigirConteudoDoFormato);

export const directionSchema = z.object({
  name: z.string().trim().min(2).max(80),
  hypothesis: z.string().trim().min(2),
  problem: z.string().trim().min(2),
  promise: z.string().trim().min(2),
  hook: z.string().trim().min(2).max(160),
  mechanism: z.string().trim().min(2),
  proof: z.string().trim().default(""),
  objection: z.string().trim().default(""),
  cta: z.string().trim().min(1).max(40),
  visual_prompt: z.string().trim().min(10),
  rationale: z.string().trim().default(""),
  /*
   * As copies não vêm mais junto dos caminhos.
   *
   * Pedir 3 caminhos com 3 copies estruturadas de uma vez levava 121 segundos e
   * estourava o tempo da função — a campanha morria no meio e o job ficava
   * órfão. Agora cada caminho tem a sua chamada, e elas correm em paralelo:
   * o relógio passa a ser o da chamada mais lenta, não o da soma.
   */
  copies: z.array(directionCopySchema).max(5).default([]),
});

export const directionsResponseSchema = z.object({
  directions: z.array(directionSchema).min(3).max(5),
});

export const copiesResponseSchema = z.object({
  copies: z.array(copySchema).min(1).max(5),
});

export const brandAnalysisSchema = z.object({
  name: z.string().trim().default(""),
  description: z.string().trim().max(1200).default(""),
  segment: z.string().trim().max(120).default(""),
  voice_tone: z.string().trim().max(200).default(""),
  colors: z
    .array(
      z.object({
        hex: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
        role: z.enum(["primaria", "secundaria", "apoio", "fundo", "texto"]).default("apoio"),
        label: z.string().trim().max(40).default(""),
      }),
    )
    .max(8)
    .default([]),
  products: z
    .array(z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(400).default("") }))
    .max(10)
    .default([]),
  audience: z.string().trim().max(400).default(""),
  differentiators: z.array(z.string().trim().min(1).max(160)).max(10).default([]),
  confidence: z.enum(["alta", "media", "baixa"]).default("media"),
});

/**
 * Uma rodada da conversa de onboarding com quem não tem site.
 *
 * O modelo devolve tudo o que já conseguiu entender e, se ainda falta algo
 * essencial, UMA pergunta — nunca um formulário disfarçado de conversa.
 */
export const brandInterviewSchema = z.object({
  analysis: brandAnalysisSchema,
  question: z.string().trim().max(240).default(""),
  complete: z.boolean().default(false),
});

export const nextTestSchema = z.object({
  best_angle: z.string().trim().default(""),
  best_hook: z.string().trim().default(""),
  best_format: z.string().trim().default(""),
  best_offer: z.string().trim().default(""),
  learnings: z.array(z.string().trim().min(1)).max(6).default([]),
  next_test: z.string().trim().min(2),
  caveat: z.string().trim().default(""),
});

export type Brief = z.infer<typeof briefSchema>;
export type ChatQuestion = z.infer<typeof chatQuestionSchema>;
export type DirectionPayload = z.infer<typeof directionSchema>;
export type BrandAnalysis = z.infer<typeof brandAnalysisSchema>;
export type BrandInterview = z.infer<typeof brandInterviewSchema>;
