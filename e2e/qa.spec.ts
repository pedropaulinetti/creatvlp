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
  await tirar("05-onboarding-conversa");
  await page
    .getByLabel("Sua resposta")
    .fill("Minas Estate Coffee, café especial de fazenda em Minas, para quem faz café em casa.");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByRole("heading", { name: "Encontramos sua marca." })).toBeVisible();
  await page.locator("#rev-company").fill("Minas Estate Coffee");
  await page.getByRole("textbox", { name: "Produto 1" }).fill("Bourbon Amarelo");
  await tirar("06-onboarding-confirmacao");
  await page.getByRole("button", { name: "É isso, criar marca" }).click();
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
