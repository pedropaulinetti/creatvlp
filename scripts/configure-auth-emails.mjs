#!/usr/bin/env node
/**
 * Configura os e-mails de autenticação do Supabase.
 *
 * O template de recuperação de senha manda `{{ .Token }}`, não
 * `{{ .ConfirmationURL }}`. É isso que faz a recuperação virar código de seis
 * dígitos em vez de link mágico, igual à confirmação de cadastro. Dá para
 * trocar no painel, mas aqui fica versionado e sai igual toda vez.
 *
 *   npm run auth:emails                  recuperação de senha
 *   npm run auth:emails -- --cadastro    também reescreve o e-mail de cadastro
 *
 * Precisa no .env.local (ou exportado no shell):
 *   SUPABASE_ACCESS_TOKEN   token pessoal do Supabase, começa com sbp_
 *
 * Opcional, só quando for trocar o SMTP:
 *   RESEND_API_KEY          chave da Resend, formato re_. Vira a senha do SMTP.
 *   AUTH_SENDER_EMAIL       remetente no domínio verificado na Resend
 *   AUTH_SENDER_NAME        nome que aparece na caixa de entrada
 *
 * Sem RESEND_API_KEY o SMTP fica como está e só os templates são publicados.
 */
import { readFileSync, existsSync } from "node:fs";

const REF = process.env.PROJECT_REF ?? "hqmhxoismhzcrytkqdpi";
const ARQUIVO = ".env.local";

function lerEnvLocal() {
  const valores = new Map();
  if (!existsSync(ARQUIVO)) return valores;
  for (const linha of readFileSync(ARQUIVO, "utf8").split("\n")) {
    const limpa = linha.trim();
    if (!limpa || limpa.startsWith("#")) continue;
    const igual = limpa.indexOf("=");
    if (igual < 1) continue;
    const nome = limpa.slice(0, igual).trim();
    const valor = limpa.slice(igual + 1).trim().replace(/^["']|["']$/g, "");
    if (valor) valores.set(nome, valor);
  }
  return valores;
}

const arquivo = lerEnvLocal();
const ler = (nome, padrao) => process.env[nome] || arquivo.get(nome) || padrao;

const acesso = ler("SUPABASE_ACCESS_TOKEN");
if (!acesso) {
  console.error(
    "Falta o SUPABASE_ACCESS_TOKEN.\n" +
      "Gere em supabase.com/dashboard/account/tokens e preencha no .env.local.",
  );
  process.exit(1);
}

const resend = ler("RESEND_API_KEY");
if (resend && !resend.startsWith("re_")) {
  console.error(`RESEND_API_KEY com formato inesperado (${resend.slice(0, 4)}…). A chave da Resend começa com re_.`);
  process.exit(1);
}

/**
 * Acentos viram entidades HTML.
 * Cliente de e-mail antigo ainda erra a codificação do corpo, e "código" com
 * acento quebrado num e-mail de segurança parece golpe.
 */
const ENTIDADES = {
  á: "aacute", à: "agrave", â: "acirc", ã: "atilde", ä: "auml",
  é: "eacute", ê: "ecirc", í: "iacute", ó: "oacute", ô: "ocirc",
  õ: "otilde", ö: "ouml", ú: "uacute", ü: "uuml", ç: "ccedil",
  Á: "Aacute", À: "Agrave", Â: "Acirc", Ã: "Atilde",
  É: "Eacute", Ê: "Ecirc", Í: "Iacute", Ó: "Oacute", Ô: "Ocirc",
  Õ: "Otilde", Ú: "Uacute", Ç: "Ccedil",
};
const escapar = (texto) => texto.replace(/[^\x00-\x7F]/g, (c) => (ENTIDADES[c] ? `&${ENTIDADES[c]};` : c));

/**
 * O corpo do e-mail, na paleta clara do app.
 * Os dois e-mails compartilham o mesmo desenho de propósito: quem acabou de
 * criar a conta reconhece o de recuperação como vindo do mesmo lugar.
 */
function email({ titulo, explicacao, aviso }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#EEEAE3;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EEEAE3;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;background:#FFFDFA;border:1px solid #E2DCD1;border-radius:16px;padding:36px 32px;">
        <tr><td>
          <p style="margin:0 0 6px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#B4623A;">CreatvOS</p>
          <h1 style="margin:0 0 14px;font-size:22px;font-weight:500;color:#171412;letter-spacing:-.02em;">${escapar(titulo)}</h1>
          <p style="margin:0 0 26px;font-size:14px;line-height:1.6;color:#5B534C;">${escapar(explicacao)}</p>
          <div style="background:#F5F1EA;border:1px solid #E2DCD1;border-radius:12px;padding:20px;text-align:center;">
            <span style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:32px;font-weight:600;letter-spacing:.34em;color:#171412;">{{ .Token }}</span>
          </div>
          <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#8A8078;">${escapar(aviso)}</p>
        </td></tr>
      </table>
      <p style="margin:20px 0 0;font-size:11.5px;color:#8A8078;">CreatvOS &middot; creatv.com.br</p>
    </td></tr>
  </table>
</body></html>`;
}

const config = {
  // Seis dígitos, dez minutos. O mesmo par que as telas prometem em texto.
  mailer_otp_length: 6,
  mailer_otp_exp: 600,

  mailer_subjects_recovery: "Seu código para criar uma nova senha · CreatvOS",
  mailer_templates_recovery_content: email({
    titulo: "Seu código para criar uma nova senha",
    explicacao: "Digite o código abaixo no CreatvOS para definir a nova senha da sua conta.",
    aviso:
      "O código vale por 10 minutos. Se não foi você que pediu, pode ignorar este e-mail: sua senha continua a mesma.",
  }),
};

if (process.argv.includes("--cadastro")) {
  config.mailer_subjects_confirmation = "Seu código de confirmação · CreatvOS";
  config.mailer_templates_confirmation_content = email({
    titulo: "Seu código de confirmação",
    explicacao: "Digite o código abaixo no CreatvOS para confirmar seu e-mail e começar.",
    aviso: "O código vale por 10 minutos. Se não foi você que pediu, pode ignorar este e-mail.",
  });
}

// SMTP próprio. O embutido do Supabase entrega poucos e-mails por hora e
// derruba cadastro e recuperação assim que aparece mais de um usuário junto.
if (resend) {
  config.smtp_host = "smtp.resend.com";
  config.smtp_port = "465";
  config.smtp_user = "resend";
  config.smtp_pass = resend;
  config.smtp_max_frequency = 60;
  const remetente = ler("AUTH_SENDER_EMAIL");
  const nomeRemetente = ler("AUTH_SENDER_NAME");
  if (remetente) config.smtp_admin_email = remetente;
  if (nomeRemetente) config.smtp_sender_name = nomeRemetente;
}

const resposta = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${acesso}`, "Content-Type": "application/json" },
  body: JSON.stringify(config),
});

if (!resposta.ok) {
  console.error(`Falhou (HTTP ${resposta.status}):`, (await resposta.text()).slice(0, 400));
  if (resposta.status === 401) {
    console.error("\nToken recusado. Gere outro em supabase.com/dashboard/account/tokens.");
  }
  process.exit(1);
}

console.log("Autenticação por e-mail configurada no projeto", REF);
console.log("  ✓ Código de 6 dígitos, válido por 10 minutos");
console.log("  ✓ Recuperação de senha com {{ .Token }}, sem link mágico");
if (config.mailer_templates_confirmation_content) console.log("  ✓ Template de cadastro reescrito");
if (resend) console.log(`  ✓ SMTP: smtp.resend.com:465, senha ${resend.slice(0, 6)}…${resend.slice(-4)}`);
else console.log("  · SMTP mantido como estava (sem RESEND_API_KEY no .env.local)");
console.log("\nTeste pedindo uma recuperação em /recuperar-senha com um e-mail real.");
