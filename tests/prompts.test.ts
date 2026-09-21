import { describe, expect, it } from "vitest";
import {
  brandContext, chatSystemPrompt, directionsPrompt, imagePrompt, nextTestPrompt, pecaCompletaPrompt,
} from "../supabase/functions/_shared/prompts.ts";

const brand = {
  name: "Minas Estate Coffee",
  description: "Torrefação de cafés especiais",
  website: "https://minasestate.com.br",
  segment: "Alimentos e bebidas",
  voice_tone: "Próximo e informativo",
  voice_notes: "Fala em primeira pessoa do plural",
  recommended_words: ["origem", "torra"],
  forbidden_words: ["barato", "imperdível"],
  forbidden_promises: ["emagrece"],
  differentiators: ["Origem rastreável"],
  competitors: [{ name: "Concorrente A", note: "forte em varejo" }],
  proofs: [{ statement: "2 mil clientes recorrentes", source: "CRM" }],
  recurring_offers: [{ name: "Frete grátis", detail: "acima de R$ 120" }],
  colors: [{ hex: "#B4623A", role: "primaria" }],
  channels: ["Meta Ads"],
  formats: ["4:5"],
};

const brief = {
  campaign_name: "Dia dos Pais",
  objective: "Vendas",
  product: "Café especial",
  audience: "Amantes de café",
  offer: "10% off",
  channel: "Meta Ads",
  formats: ["4:5" as const],
  quantity: 6,
  voice_tone: "",
  restrictions: [],
  occasion: "Dia dos Pais",
  occasion_date: "",
  cta: "Comprar agora",
  primary_metric: "ROAS",
};

describe("brandContext", () => {
  it("inclui as restrições que a IA precisa respeitar", () => {
    const context = brandContext(brand);
    expect(context).toContain("Palavras PROIBIDAS");
    expect(context).toContain("barato");
    expect(context).toContain("Promessas PROIBIDAS");
    expect(context).toContain("emagrece");
  });

  it("achata listas de objetos de forma legível", () => {
    const context = brandContext(brand);
    expect(context).toContain("2 mil clientes recorrentes — CRM");
    expect(context).toContain("Frete grátis — acima de R$ 120");
  });

  it("marca campos ausentes em vez de deixar vazio", () => {
    const context = brandContext({ ...brand, differentiators: [], proofs: [] });
    expect(context).toContain("Diferenciais: não informado");
    expect(context).toContain("Provas e credenciais: não informado");
  });

  it("diz explicitamente quando não há palavra proibida", () => {
    const context = brandContext({ ...brand, forbidden_words: [] });
    expect(context).toContain("Palavras PROIBIDAS (nunca use): nenhuma");
  });

  it("inclui produtos, públicos e aprendizados quando existem", () => {
    const context = brandContext(
      brand,
      [{ name: "Bourbon Amarelo", description: "Torra média", price_cents: 8990, highlights: ["doce"] }],
      [{ name: "Baristas caseiros", description: "Fazem café em casa", pains: ["não sabe escolher"], desires: null, objections: null }],
      [{ kind: "angulo", statement: "Prova social funcionou", confidence: "sinal" }],
    );
    expect(context).toContain("Bourbon Amarelo");
    expect(context).toContain("R$ 89.90");
    expect(context).toContain("Baristas caseiros");
    expect(context).toContain("[angulo/sinal]");
  });
});

describe("chatSystemPrompt", () => {
  it("limita as perguntas complementares a três", () => {
    const prompt = chatSystemPrompt(brandContext(brand));
    expect(prompt).toContain("no máximo 3 perguntas");
  });

  it("impede que a IA peça o que já está na memória", () => {
    expect(chatSystemPrompt("contexto")).toContain("Não peça o que já está nela");
  });

  it("exige JSON puro, sem markdown", () => {
    expect(chatSystemPrompt("contexto")).toContain("sem markdown");
  });
});

describe("directionsPrompt", () => {
  /*
   * A regra mudou de natureza quando a peça passou a ser desenhada inteira.
   * Antes o visual_prompt não podia citar texto porque o texto era composto
   * depois; agora ele descreve o anúncio todo, e o que não pode é ditar a copy
   * ou a diagramação — senão a cena só encaixa num layout.
   */
  it("pede uma cena ampla, que caiba em layouts diferentes", () => {
    const prompt = directionsPrompt(brandContext(brand), brief, 4);
    expect(prompt).toContain("descreve o ANÚNCIO INTEIRO");
    expect(prompt).toContain("AMPLO o bastante para caber em layouts muito diferentes");
  });

  it("continua proibindo escrever a copy dentro do prompt visual", () => {
    const prompt = directionsPrompt(brandContext(brand), brief, 4);
    expect(prompt).toContain("NÃO escreva dentro do \"visual_prompt\" o texto do anúncio");
  });

  it("não deixa o prompt visual ditar a diagramação", () => {
    expect(directionsPrompt("contexto", brief, 4)).toContain("nada de dizer onde fica o título");
  });

  it("impede inventar prova que não está na marca", () => {
    const prompt = directionsPrompt("contexto", brief, 4);
    expect(prompt).toContain('só pode citar provas que estejam na memória da marca');
  });

  it("pede a quantidade solicitada de caminhos", () => {
    expect(directionsPrompt("contexto", brief, 5)).toContain("propor 5 caminhos");
  });

  it("carrega o briefing inteiro para o modelo", () => {
    const prompt = directionsPrompt("contexto", brief, 3);
    expect(prompt).toContain("Dia dos Pais");
    expect(prompt).toContain("ROAS");
  });
});

describe("imagePrompt", () => {
  it("reforça que nenhum texto pode aparecer na imagem", () => {
    const prompt = imagePrompt("Mesa de madeira com xícara ao centro", brand, "4:5");
    expect(prompt).toContain("não pode conter nenhum texto");
    expect(prompt).toContain("logotipo");
    expect(prompt).toContain("etiqueta de preço");
  });

  it("traduz o formato para orientação de enquadramento", () => {
    expect(imagePrompt("cena", brand, "9:16")).toContain("vertical 9:16");
    expect(imagePrompt("cena", brand, "1:1")).toContain("quadrado 1:1");
  });

  it("sem referência, não fala de referência nenhuma", () => {
    const prompt = imagePrompt("cena", brand, "4:5");
    expect(prompt).not.toContain("imagem de referência");
    expect(prompt).not.toContain("imagens de referência");
  });

  it("com a foto do produto, manda reproduzir aquele produto", () => {
    // Sem isto a peça saía com foto de banco de imagens em vez do que a marca vende.
    const prompt = imagePrompt("cena", brand, "4:5", { produto: true, estilo: 0 });
    expect(prompt).toContain("produto real desta marca");
    expect(prompt).toContain("fidelidade");
    expect(prompt).not.toContain("como esta marca se fotografa");
  });

  it("com referências de estilo, pede a mesma luz sem copiar", () => {
    const prompt = imagePrompt("cena", brand, "4:5", { produto: true, estilo: 2 });
    expect(prompt).toContain("como esta marca se fotografa");
    expect(prompt).toContain("Não as copie");
  });

  it("proíbe texto e logo mesmo havendo referências", () => {
    // Texto e logo são compostos depois: o que o modelo escreve sai torto.
    const prompt = imagePrompt("cena", brand, "4:5", { produto: true, estilo: 3 });
    expect(prompt).toContain("não pode conter nenhum texto");
    expect(prompt).toContain("logotipo");
    expect(imagePrompt("cena", brand, "4:5")).toContain("vertical 4:5");
  });

  it("pede espaço negativo dentro da cena, não um bloco chapado", () => {
    const prompt = imagePrompt("cena", brand, "4:5");
    expect(prompt).toContain("espaço negativo natural");
    // O bloco chapado era o defeito: a foto precisa preencher o quadro.
    expect(prompt).toContain("preenche o quadro inteiro");
    expect(prompt).toContain("sem faixas");
  });

  it("mantém a descrição de cena vinda do caminho criativo", () => {
    expect(imagePrompt("Mesa de madeira com xícara ao centro", brand, "4:5")).toContain(
      "Mesa de madeira com xícara ao centro",
    );
  });
});

describe("nextTestPrompt", () => {
  it("proíbe afirmar causalidade com pouca amostra", () => {
    const prompt = nextTestPrompt("contexto", [], []);
    expect(prompt).toContain("NUNCA afirme causalidade");
    expect(prompt).toContain("sinal observado");
  });

  it("proíbe inventar métrica ausente", () => {
    expect(nextTestPrompt("contexto", [], [])).toContain("Não invente métrica");
  });
});

describe("pecaCompletaPrompt", () => {
  const peca = {
    estrutura: "",
    headline: "Seu merino passou por um banho químico",
    subheadline: "O nosso não",
    cta: "Comprar agora",
    price: "",
    bullets: ["94% recomendam"],
    palette: { ink: "#171412", surface: "#FFFDFA", accent: "#B4623A" },
    typography: { headline: "Inter", body: "Inter" },
    format: "4:5",
  };

  it("descreve a estrutura da referência quando ela existe", () => {
    const prompt = pecaCompletaPrompt(
      { ...peca, estrutura: "Bloco de cor com selo redondo" },
      brand,
      { produto: true, layout: true, estilo: 0 },
    );
    expect(prompt).toContain("Bloco de cor com selo redondo");
    expect(prompt).toContain("Dessa imagem de estrutura, aproveite só a ESTRUTURA");
  });

  it("proíbe copiar a marca da referência", () => {
    const prompt = pecaCompletaPrompt({ ...peca, temReferencia: true }, brand);
    expect(prompt).toContain("NUNCA copie");
    expect(prompt).toContain("logotipo");
  });

  /*
   * A ordem dos anexos é contrato com o `runImages`, não detalhe de redação.
   * Foi tratar a foto do produto como referência de layout que fez a peça sair
   * com um produto redesenhado em vez do produto real.
   */
  it("endereça a foto do produto como a primeira imagem, e manda reproduzi-la", () => {
    const prompt = pecaCompletaPrompt(peca, brand, { produto: true, layout: false, estilo: 0 });
    expect(prompt).toContain("A primeira imagem anexada é a fotografia do produto real");
    expect(prompt).toContain("fidelidade absoluta");
  });

  it("com produto e layout, o layout é a segunda — nunca a primeira", () => {
    const prompt = pecaCompletaPrompt(peca, brand, { produto: true, layout: true, estilo: 0 });
    expect(prompt).toContain("A primeira imagem anexada é a fotografia do produto real");
    expect(prompt).toContain("A segunda imagem anexada é um anúncio de OUTRA empresa");
    expect(prompt).not.toContain("A primeira imagem anexada é um anúncio");
  });

  it("sem foto de produto, o layout assume a primeira posição", () => {
    const prompt = pecaCompletaPrompt(peca, brand, { produto: false, layout: true, estilo: 0 });
    expect(prompt).toContain("A primeira imagem anexada é um anúncio de OUTRA empresa");
    expect(prompt).not.toContain("fotografia do produto real");
  });

  it("na regeração, a peça anterior é a primeira e carrega o produto", () => {
    const prompt = pecaCompletaPrompt(peca, brand, {
      anterior: true,
      produto: false,
      layout: true,
      estilo: 0,
    });
    expect(prompt).toContain("A primeira imagem anexada é a versão anterior desta mesma peça");
    expect(prompt).toContain("A segunda imagem anexada é um anúncio de OUTRA empresa");
  });

  it("o estilo da marca vem por último e não pode ser copiado", () => {
    const prompt = pecaCompletaPrompt(peca, brand, { produto: true, layout: true, estilo: 1 });
    expect(prompt).toContain("A terceira imagem anexada mostra");
    expect(prompt).toContain("sem copiar a cena");
  });

  it("sem anexo nenhum, não promete imagem que não foi enviada", () => {
    const prompt = pecaCompletaPrompt(peca, brand);
    expect(prompt).not.toContain("imagem anexada");
  });

  it("sem referência nenhuma, ainda entrega um prompt utilizável", () => {
    const prompt = pecaCompletaPrompt(peca, brand);
    expect(prompt).toContain(peca.headline);
    expect(prompt).toContain(peca.cta);
    expect(prompt).not.toContain("imagem anexada");
  });

  it("exige a cor de acento como elemento, não só como paleta", () => {
    expect(pecaCompletaPrompt(peca, brand)).toContain("#B4623A");
  });

  /*
   * O papel invertido era o que fazia toda peça sair preta: `ink` é a cor do
   * TEXTO, e o prompt a pedia "como fundo escuro". Numa marca de fundo branco
   * isso mandava pintar a peça inteira de preto.
   */
  it("chama o fundo de fundo e o texto de texto", () => {
    const daMemoe = {
      ...peca,
      palette: { ink: "#000000", surface: "#FFFFFF", accent: "#F5B700" },
    };
    const prompt = pecaCompletaPrompt(daMemoe, brand);
    expect(prompt).toContain("#FFFFFF é a cor de fundo");
    expect(prompt).toContain("#000000 é a cor do texto");
    expect(prompt).not.toContain("#000000 como fundo escuro");
  });

  it("diz qual das duas é a clara, para o modelo montar o contraste", () => {
    const prompt = pecaCompletaPrompt(
      { ...peca, palette: { ink: "#000000", surface: "#FFFFFF", accent: "#F5B700" } },
      brand,
    );
    expect(prompt).toContain("(clara)");
    expect(prompt).toContain("(escura)");
  });

  it("marca de fundo escuro não é forçada a clarear", () => {
    const prompt = pecaCompletaPrompt(
      { ...peca, palette: { ink: "#FFFDFA", surface: "#171412", accent: "#B4623A" } },
      brand,
    );
    expect(prompt).toContain("#171412 é a cor de fundo (escura)");
  });

  /*
   * "sem serifa geométrica" estava fixo e vencia o nome da fonte pedido na
   * mesma frase: Kefir é display arredondada, Commissioner é sans de baixo
   * contraste, e as duas saíam como uma sans genérica.
   */
  it("nomeia a tipografia sem classificá-la por conta própria", () => {
    const prompt = pecaCompletaPrompt(
      { ...peca, typography: { headline: "Kefir", body: "Commissioner" } },
      brand,
    );
    expect(prompt).toContain("Kefir no título");
    expect(prompt).toContain("Commissioner no texto de apoio");
    expect(prompt).not.toContain("sem serifa geométrica");
  });

  it("fonte única não é repetida como se fossem duas", () => {
    const prompt = pecaCompletaPrompt(
      { ...peca, typography: { headline: "Inter", body: "Inter" } },
      brand,
    );
    expect(prompt).toContain("Inter no título.");
    expect(prompt).not.toContain("e Inter no texto");
  });

  it("sem tipografia definida, não inventa instrução de fonte", () => {
    const prompt = pecaCompletaPrompt(
      { ...peca, typography: { headline: "", body: "" } },
      brand,
    );
    expect(prompt).not.toContain("Tipografia:");
  });

  /*
   * Sem foto, letra no produto é invenção do modelo e tem de ser proibida.
   * Com foto, o rótulo é o produto — apagá-lo é entregar frasco genérico.
   */
  it("sem foto do produto, proíbe letra sobre o objeto", () => {
    const prompt = pecaCompletaPrompt(peca, brand, { produto: false, layout: true, estilo: 0 });
    expect(prompt).toContain("sem nenhuma letra sobre ele");
  });

  it("com foto do produto, exige o rótulo em vez de proibi-lo", () => {
    const prompt = pecaCompletaPrompt(peca, brand, { produto: true, layout: true, estilo: 0 });
    expect(prompt).toContain("MESMO RÓTULO");
    expect(prompt).toContain("não o deixe em branco");
    expect(prompt).not.toContain("Superfície limpa");
    // O que continua proibido é acrescentar, não reproduzir.
    expect(prompt).toContain("ACRESCENTAR");
  });
});

/**
 * A fotografia precisa abrir espaço onde o texto realmente cai.
 *
 * O prompt pedia folga no topo, fixo, enquanto o layout escrevia no rodapé.
 * A foto reservava um lado, o texto caía no outro, e o scrim a 45% salvava a
 * leitura por cima do que estivesse lá. Era de onde vinha o ar de foto de
 * banco com degradê.
 */
describe("espaço negativo por arquétipo", () => {
  const marca = { name: "Memoê", segment: "café" } as Parameters<typeof imagePrompt>[1];

  it("pede a metade de baixo quando o texto vai no rodapé", () => {
    const prompt = imagePrompt("cena", marca, "4:5", { produto: false, estilo: 0, arquetipo: "coluna" });
    expect(prompt).toContain("metade de baixo");
  });

  it("pede a metade direita quando os números ficam à direita", () => {
    const prompt = imagePrompt("cena", marca, "4:5", { produto: false, estilo: 0, arquetipo: "numeros" });
    expect(prompt).toContain("metade direita");
    expect(prompt).not.toContain("metade de baixo");
  });

  it("pede fundo sem assunto dominante quando a peça é quase toda tipografia", () => {
    const prompt = imagePrompt("cena", marca, "4:5", { produto: false, estilo: 0, arquetipo: "enquete" });
    expect(prompt).toContain("sem assunto dominante");
  });

  it("cai na coluna quando o arquétipo não é conhecido", () => {
    const semNome = imagePrompt("cena", marca, "4:5", { produto: false, estilo: 0 });
    const coluna = imagePrompt("cena", marca, "4:5", { produto: false, estilo: 0, arquetipo: "coluna" });
    expect(semNome).toBe(coluna);
  });
});

/**
 * Embalagem com rótulo em branco.
 *
 * Numa peça real o modelo entregou dois frascos com o rótulo vazio, em
 * tamanho de cartaz. A causa é a regra de não escrever nada, que existe para
 * ele não rabiscar palavra torta, aplicada a um produto que ele inventou. Com
 * a foto anexada a regra é outra e o rótulo sai certo.
 */
describe("rótulo da embalagem", () => {
  const marca = { name: "OTO", segment: "cuidados masculinos" } as Parameters<typeof imagePrompt>[1];

  it("sem foto do produto, proíbe embalagem em primeiro plano", () => {
    const prompt = imagePrompt("cena", marca, "4:5", { produto: false, estilo: 0 });
    expect(prompt).toContain("Nenhuma embalagem rotulada em primeiro plano");
  });

  it("com foto do produto, manda reproduzir o rótulo", () => {
    const prompt = imagePrompt("cena", marca, "4:5", { produto: true, estilo: 0 });
    expect(prompt).toContain("reproduza-o exatamente como está na foto");
    expect(prompt).not.toContain("Nenhuma embalagem rotulada em primeiro plano");
  });

  it("a vitrine pede o rótulo inteiro e de frente", () => {
    const prompt = imagePrompt("cena", marca, "4:5", { produto: true, estilo: 0, arquetipo: "vitrine" });
    expect(prompt).toContain("rótulo da embalagem precisa aparecer inteiro");
  });
});
