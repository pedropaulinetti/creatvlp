/**
 * Fluxo crítico do CreatvOS, ponta a ponta.
 * Sobe as MESMAS Edge Functions de produção com FAKE_AI=true, contra o banco
 * real. Nenhuma chamada paga de IA acontece.
 *
 *   SUPABASE_SERVICE_ROLE_KEY=... npm run test:e2e
 */
import { expect, test } from "@playwright/test";
import { adminClient, canRun, createConfirmedUser, PASSWORD, removeUser, signIn, testEmail } from "./helpers";

test.skip(!canRun, "Precisa de VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");

/**
 * Cada projeto (desktop e mobile) usa a própria conta: eles rodam em sequência
 * e o afterAll de um apagaria o usuário do outro.
 */
let email = "";

test.beforeAll(({}, testInfo) => {
  email = testEmail(`fluxo-${testInfo.project.name}`);
});

test.afterAll(async () => {
  await removeUser(email);
});

test.describe.configure({ mode: "serial" });

test.describe("do cadastro ao criativo na biblioteca", () => {
  test("1. o cadastro valida antes de enviar", async ({ page }) => {
    // O envio real de e-mail não é exercitado aqui: o SMTP embutido do Supabase
    // permite poucos e-mails por hora. O caminho de criação de conta é coberto
    // pelo teste de RLS, que cria usuários de verdade.
    await page.goto("/cadastro");
    await page.locator("#fullName").fill("P");
    await page.locator("#email").fill("sem-arroba");
    await page.locator("#password").fill("123");
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(page.getByText("Informe seu nome")).toBeVisible();
    await expect(page.getByText("E-mail inválido")).toBeVisible();
    await expect(page.getByText("A senha precisa de pelo menos 8 caracteres")).toBeVisible();

    // Continuamos o fluxo com um usuário já confirmado.
    await createConfirmedUser(email);
    const admin = adminClient();
    const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
    expect(data.users.some((item) => item.email === email)).toBe(true);
  });

  test("2. login leva ao onboarding", async ({ page }) => {
    await signIn(page, email);
    await expect(page).toHaveURL(/\/onboarding/);
    // O onboarding começa pelo site: é ele que preenche o resto.
    await expect(page.getByRole("heading", { name: "Vamos começar pelo seu site." })).toBeVisible();
    await expect(page.getByLabel("Endereço do site")).toBeVisible();
  });

  test("3. onboarding salva a marca no Supabase", async ({ page }) => {
    await signIn(page, email);

    // Sem site, o caminho é a conversa com a IA — não um formulário.
    await page.getByRole("button", { name: /Não tenho site/ }).click();
    await expect(page.getByRole("heading", { name: "Então me conta você." })).toBeVisible();

    await page
      .getByLabel("Sua resposta")
      .fill("Minas Estate Coffee, café especial de fazenda em Minas, para quem faz café em casa.");
    await page.getByRole("button", { name: "Enviar" }).click();

    // A conversa desemboca na mesma confirmação do caminho do site.
    await expect(page.getByRole("heading", { name: "Encontramos sua marca." })).toBeVisible();
    await page.locator("#rev-company").fill("Minas Estate Coffee");
    await page.getByRole("textbox", { name: "Produto 1" }).fill("Bourbon Amarelo");

    await page.getByRole("button", { name: "É isso, criar marca" }).click();
    await page.waitForURL(/\/app$/);
    await expect(page.getByRole("heading", { name: "O que você quer criar hoje?" })).toBeVisible();

    const admin = adminClient();
    const { data: brands } = await admin.from("brands").select("name").eq("name", "Minas Estate Coffee");
    expect(brands?.length, "a marca precisa existir no banco").toBeGreaterThan(0);
  });

  test("4-7. conversa vira briefing, briefing vira caminhos", async ({ page }) => {
    await signIn(page, email);

    await page.getByLabel("Descreva a campanha que você quer criar")
      .fill("Quero uma campanha para divulgar nosso café especial no Dia dos Pais.");
    // Escopo no conteúdo: a sidebar tem um botão com o mesmo rótulo.
    await page.locator("#conteudo").getByRole("button", { name: "Criar campanha" }).click();

    await page.waitForURL(/\/app\/campanhas\/nova/);

    // O briefing estruturado aparece para confirmação, antes de qualquer geração.
    await expect(page.getByText("Briefing", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Campanha de teste").first()).toBeVisible();
    await expect(page.getByText(/Nenhum crédito de imagem é usado nesta etapa/)).toBeVisible();

    await page.getByRole("button", { name: "Confirmar e gerar caminhos" }).click();

    await page.waitForURL(/\/app\/campanhas\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: /Campanha de teste/ })).toBeVisible();

    // Três caminhos criativos, cada um com sua hipótese.
    await expect(page.getByText("Caminho 1")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByText("Caminho 2")).toBeVisible();
    await expect(page.getByText("Caminho 3")).toBeVisible();
  });

  test("8. selecionar caminho mostra o custo antes de gerar a imagem", async ({ page }) => {
    await signIn(page, email);
    await page.goto("/app/campanhas");
    await page.getByText("Campanha de teste").first().click();
    await page.waitForURL(/\/app\/campanhas\/[0-9a-f-]{36}/);

    await page.getByRole("checkbox", { name: /Selecionar Caminho 1/ }).click();
    await expect(page.getByText("1 caminho selecionado")).toBeVisible();

    await page.getByRole("button", { name: "Gerar imagens" }).click();

    // O usuário vê o consumo e o custo antes de confirmar.
    await expect(page.getByText("Créditos consumidos")).toBeVisible();
    await expect(page.getByText("Custo estimado")).toBeVisible();
    await expect(page.getByText("Qualidade da imagem")).toBeVisible();
    await expect(page.getByText("Rascunho")).toBeVisible();

    // Cada peça é um anúncio desenhado por inteiro: a quantidade pedida é a
    // quantidade entregue, e cada uma consome um crédito.
    await expect(page.getByText("Quantas peças")).toBeVisible();
    await expect(page.getByText("Peças entregues")).toBeVisible();
    await expect(page.getByText(/uma geração por peça/)).toBeVisible();

    await page.getByLabel("Quantidade de peças").fill("2");
    await page.getByRole("button", { name: /Gerar 2 peças/ }).click();
    await expect(page.getByText(/2 peças geradas/)).toBeVisible({ timeout: 90_000 });
  });

  test("9-10. aprovar o criativo e encontrá-lo na biblioteca", async ({ page }) => {
    await signIn(page, email);
    await page.goto("/app/campanhas");
    await page.getByText("Campanha de teste").first().click();

    await page.getByRole("tab", { name: /Criativos/ }).click();
    await expect(page.getByText("Para revisar").first()).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "Aprovar" }).first().click();
    await expect(page.getByText("Aprovado").first()).toBeVisible({ timeout: 20_000 });

    await page.goto("/app/biblioteca");
    await expect(page.getByRole("heading", { name: "Tudo que já foi produzido" })).toBeVisible();
    await expect(page.getByText("Aprovado").first()).toBeVisible({ timeout: 20_000 });
  });

  // Rotinas está travada como "em breve": a rota devolve para o início e a tela não abre.
  test.skip("11. criar rotina, começando com geração automática desligada", async ({ page }) => {
    await signIn(page, email);
    await page.goto("/app/rotinas");

    await page.getByRole("button", { name: "Nova rotina" }).click();
    await page.locator("#routine-name").fill("Promoções da semana");

    // Segurança: a rotina nasce sem gerar nada sozinha.
    const autoSwitch = page.getByRole("switch", { name: "Gerar caminhos criativos automaticamente" });
    await expect(autoSwitch).toHaveAttribute("data-state", "unchecked");
    const imageSwitch = page.getByRole("switch", { name: "Autorizar geração de imagens" });
    await expect(imageSwitch).toBeDisabled();

    await expect(page.getByText("Próxima execução:")).toBeVisible();

    await page.getByRole("button", { name: "Criar rotina" }).click();
    await expect(page.getByText("Promoções da semana").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Só o briefing")).toBeVisible();
  });
});
