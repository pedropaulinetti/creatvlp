import { createClient } from "@supabase/supabase-js";
import type { Page } from "@playwright/test";

export const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
export const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const PASSWORD = "SenhaDeTeste123";

export const canRun = Boolean(SUPABASE_URL && SERVICE_KEY);

export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

/**
 * O Supabase recusa TLDs reservados como .test, e o SMTP embutido limita o
 * envio a poucos e-mails por hora. Por isso os usuários do e2e são criados
 * pela Admin API (sem e-mail) num domínio válido.
 */
export function testEmail(prefix: string) {
  return `e2e-${prefix}-${Math.random().toString(36).slice(2, 8)}@creatvos-e2e.com`;
}

/** Cria um usuário já confirmado, sem disparar e-mail. */
export async function createConfirmedUser(email: string, fullName = "Pedro Teste") {
  const admin = adminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error) throw error;
  return data.user!;
}

/** Remove o usuário e, em cascata, tudo que ele criou. */
export async function removeUser(email: string) {
  if (!canRun) return;
  const admin = adminClient();
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  const user = data.users.find((item) => item.email === email);
  if (user) await admin.auth.admin.deleteUser(user.id).catch(() => undefined);
}

// Os campos são localizados por id: o rótulo "Senha" também casa com o botão
// "Mostrar senha", que fica dentro do mesmo campo.
export async function signUp(page: Page, email: string, name = "Pedro Teste") {
  await page.goto("/cadastro");
  await page.locator("#fullName").fill(name);
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Criar conta" }).click();
}

/** Espera o redirecionamento: sem isso, o goto seguinte volta para o login. */
export async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.locator("#email").fill(email);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/\/(app|onboarding)/, { timeout: 30_000 });
}
