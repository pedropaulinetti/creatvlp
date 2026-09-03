/**
 * Varredura de QA: percorre as telas do app, captura erros de console e
 * grava as imagens em /tmp/qa. Não roda no CI — é ferramenta de revisão.
 */
import { expect, test } from "@playwright/test";
import { canRun, createConfirmedUser, removeUser, signIn, testEmail } from "./helpers";

test.skip(!canRun || !process.env.QA_SWEEP, "Defina QA_SWEEP=1 para rodar a varredura.");

const email = testEmail(`qa-${process.env.TEST_PARALLEL_INDEX ?? "0"}`);
const problemas: string[] = [];

test.afterAll(async () => {
  await removeUser(email);
  if (problemas.length) {
    console.log("\nProblemas de console encontrados:");
    for (const item of problemas) console.log("  -", item);
  } else {
    console.log("\nNenhum erro de console nas telas visitadas.");
  }
});

test("percorre as telas e captura o console", async ({ page }, testInfo) => {
  test.setTimeout(180_000);

  page.on("console", (message) => {
    if (message.type() === "error") problemas.push(`${page.url()} :: ${message.text().slice(0, 200)}`);
  });
  page.on("pageerror", (error) => problemas.push(`${page.url()} :: ${error.message.slice(0, 200)}`));

  const sufixo = testInfo.project.name;
  const tirar = async (nome: string) => {
    await page.waitForTimeout(600);
    await page.screenshot({ path: `/tmp/qa/${nome}-${sufixo}.png`, fullPage: false });
  };

  await page.goto("/login");
  await tirar("01-login");

  await page.goto("/cadastro");
  await tirar("02-cadastro");

  await page.goto("/recuperar-senha");
  await tirar("03-recuperar");

  await createConfirmedUser(email);
  await signIn(page, email);
  await expect(page).toHaveURL(/\/onboarding/);
  await tirar("04-onboarding");

  await page.getByRole("button", { name: /Não tenho site/ }).click();
  await page.locator("#company").fill("Minas Estate Coffee");
  await page.getByRole("button", { name: "Continuar" }).click();
  await tirar("05-onboarding-identidade");
  await page.getByRole("button", { name: "Pular" }).click();
  await page.getByRole("button", { name: "+ Adicionar produto" }).click();
  await page.getByPlaceholder("Nome do produto ou serviço").fill("Bourbon Amarelo");
  await page.getByRole("button", { name: "Continuar" }).click();
  for (let i = 0; i < 4; i += 1) await page.getByRole("button", { name: "Pular" }).click();
  await tirar("06-onboarding-revisao");
  await page.getByRole("button", { name: "Criar minha marca" }).click();
  await page.waitForURL(/\/app$/);
  await tirar("07-inicio");

  await page.goto("/app/marca");
  await tirar("08-marca");

  await page.goto("/app/rotinas");
  await tirar("09-rotinas-vazio");

  await page.goto("/app/biblioteca");
  await tirar("10-biblioteca-vazia");

  await page.goto("/app/campanhas");
  await tirar("11-campanhas-vazio");

  await page.goto("/app/configuracoes");
  await tirar("12-configuracoes");

  await page.goto("/app/campanhas/nova");
  await tirar("13-conversa");

  await page.goto("/admin");
  await tirar("14-admin-negado");
});
