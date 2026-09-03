/** A landing e a pesquisa existentes não podem quebrar. */
import { expect, test } from "@playwright/test";

test.describe("páginas públicas preservadas", () => {
  test("a landing continua no ar, com o tema escuro original", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Transforme seus produtos");
    await expect(page.locator("html")).toHaveAttribute("data-surface", "site");

    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe("rgb(11, 16, 19)");
  });

  test("a pesquisa continua acessível", async ({ page }) => {
    await page.goto("/pesquisa");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-surface", "site");
  });

  test("o app usa o tema claro, sem herdar o CSS da landing", async ({ page }) => {
    await page.goto("/");
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-surface", "app");

    const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(background).toBe("rgb(238, 234, 227)");
  });

  test("rotas do app exigem login", async ({ page }) => {
    await page.goto("/app/biblioteca");
    await expect(page).toHaveURL(/\/login/);
  });

  test("o admin exige login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("endereço inexistente mostra a página 404", async ({ page }) => {
    await page.goto("/rota-que-nao-existe");
    await expect(page.getByRole("heading", { name: "Esta página não existe" })).toBeVisible();
  });
});
