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

    // Sem site, o caminho é etapa a etapa.
    await page.getByRole("button", { name: /Não tenho site/ }).click();
    await expect(page.getByRole("heading", { name: "Qual é a marca?" })).toBeVisible();

    await page.locator("#company").fill("Minas Estate Coffee");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Identidade é opcional.
    await page.getByRole("button", { name: "Pular" }).click();

    await page.getByRole("button", { name: "+ Adicionar produto" }).click();
    await page.getByPlaceholder("Nome do produto ou serviço").fill("Bourbon Amarelo");
    await page.getByRole("button", { name: "Continuar" }).click();

    // Público, voz, canais e frequência podem ser pulados.
    for (let step = 0; step < 4; step += 1) {
      await page.getByRole("button", { name: "Pular" }).click();
    }

    await expect(page.getByRole("heading", { name: "Confira a memória da marca" })).toBeVisible();
    await expect(page.getByText("Minas Estate Coffee").first()).toBeVisible();

    await page.getByRole("button", { name: "Criar minha marca" }).click();
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

    await page.getByRole("button", { name: /Gerar 1 imagem/ }).click();
    await expect(page.getByText(/1 criativos? gerados?/)).toBeVisible({ timeout: 60_000 });
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

  test("11. criar rotina, começando com geração automática desligada", async ({ page }) => {
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
