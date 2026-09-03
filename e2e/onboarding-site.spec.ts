/**
 * O caminho principal do onboarding: cola o site, o site preenche o resto.
 * Usa a Edge Function publicada (leitura de site não depende de IA), então
 * exige rede. Pulado sem credenciais.
 */
import { expect, test } from "@playwright/test";
import { adminClient, canRun, createConfirmedUser, removeUser, signIn, testEmail } from "./helpers";

test.skip(!canRun, "Precisa de VITE_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.");

let email = "";

test.beforeAll(({}, testInfo) => {
  email = testEmail(`site-${testInfo.project.name}`);
});

test.afterAll(async () => {
  if (email) await removeUser(email);
});

test("o site preenche a marca sozinho", async ({ page }, testInfo) => {
  // Depende de rede e da função publicada; um navegador basta.
  test.skip(testInfo.project.name !== "desktop", "Roda só no desktop.");
  test.setTimeout(180_000);

  await createConfirmedUser(email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/onboarding/);

  // As funções sobem localmente no e2e com provider fake; a leitura de site
  // precisa da função publicada, que não usa IA para extrair o design system.
  await page.unroute("**/*").catch(() => undefined);
  await page.route("**/functions/v1/analyze-brand", async (route) => {
    const response = await route.fetch({
      url: `${process.env.VITE_SUPABASE_URL}/functions/v1/analyze-brand`,
    });
    await route.fulfill({ response });
  });

  await page.getByLabel("Endereço do site").fill("https://www.creatv.com.br");
  await page.getByRole("button", { name: "Analisar" }).click();

  // A leitura acontece à vista, etapa por etapa.
  await expect(page.getByText("Folhas de estilo")).toBeVisible({ timeout: 30_000 });

  // E termina na confirmação, com o que foi lido do CSS.
  await expect(page.getByRole("heading", { name: "Encontramos sua marca." })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Lido de www.creatv.com.br")).toBeVisible();
  await expect(page.getByText("Paleta ·")).toBeVisible();
  await expect(page.getByText("#7899AB")).toBeVisible();
  await expect(page.getByText("Instrument Serif")).toBeVisible();
  // A logo aparece como imagem, não como texto dizendo que veio.
  await expect(page.getByAltText("Logo importada do site")).toBeVisible();

  // Uma tela só: dá para concluir daqui, sem nenhuma etapa pelo caminho.
  await page.locator("#rev-company").fill("CreatvOS");
  const primeiroProduto = page.getByRole("textbox", { name: "Produto 1" });
  if (await primeiroProduto.count()) {
    await primeiroProduto.fill("Plano Beta");
  } else {
    await page.getByRole("button", { name: "Adicionar produto" }).click();
    await page.getByRole("textbox", { name: "Produto 1" }).fill("Plano Beta");
  }

  await page.getByRole("button", { name: "É isso, criar marca" }).click();
  await page.waitForURL(/\/app$/, { timeout: 40_000 });

  const admin = adminClient();
  const { data } = await admin.from("brands").select("name, colors, typography, logo_path").eq("name", "CreatvOS");
  const marca = data?.[0];
  expect(marca, "a marca precisa ter sido gravada").toBeTruthy();
  expect((marca!.colors as unknown[]).length, "a paleta lida do CSS deve ser salva").toBeGreaterThan(0);
  expect((marca!.typography as { headline?: string }).headline).toBeTruthy();
  expect(marca!.logo_path, "a logo deve ficar no nosso Storage").toBeTruthy();
});
