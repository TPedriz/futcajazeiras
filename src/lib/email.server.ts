// Envio de e-mails via Resend (domínio futcajazeiras.com.br). Somente servidor.
// Todas as chamadas ao Resend usam fetch — nada é exposto ao cliente.
export { emailSintetico, emailReal } from "./email";

// Suporte a process.env sem exigir @types/node no tsconfig deste projeto.
declare const process: {
  env: Record<string, string | undefined>;
};

const RESEND_API = "https://api.resend.com/emails";

export function urlBase(): string {
  return process.env.APP_PUBLIC_URL || "https://futcajazeiras.com.br";
}

function resendKey(): string {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY não configurado");
  return key;
}

function remetente(): string {
  return process.env.RESEND_FROM_EMAIL || "Fut Cajazeiras <nao-responder@futcajazeiras.com.br>";
}

export async function enviarEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: remetente(),
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
    }),
  });
  if (!res.ok) {
    const texto = await res.text().catch(() => "");
    console.error(`[Resend] falha ao enviar [${res.status}]: ${texto}`);
    throw new Error(`Falha ao enviar o e-mail [${res.status}]`);
  }
}

function shell(html: string): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Fut Cajazeiras</title>
  </head>
  <body style="margin:0;background:#0d0d0d;font-family:Inter,Arial,sans-serif;color:#f5f5f5">
    <div style="max-width:520px;margin:0 auto;padding:32px 20px">
      <div style="text-align:center;font-family:'Bebas Neue',Arial,sans-serif;font-size:28px;letter-spacing:2px;color:#e6b93f;margin-bottom:24px">
        FUT CAJAZEIRAS
      </div>
      <div style="background:#1a1a1a;border:1px solid #2c2c2c;border-radius:14px;padding:28px">
        ${html}
      </div>
      <p style="text-align:center;font-size:11px;color:#8a8a8a;margin-top:20px">
        Fut Cajazeiras — Gestão do Baba · <a href="${urlBase()}" style="color:#e6b93f">${urlBase()}</a>
      </p>
    </div>
  </body>
</html>`;
}

/** E-mail com o link de recuperação de senha (requer e-mail real cadastrado). */
export function htmlRecuperacaoSenha(opts: { nome: string; link: string }): string {
  return shell(`
    <h1 style="margin:0 0 12px;font-size:20px;color:#ffffff">Recuperação de senha</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#cfcfcf">
      Olá, <strong style="color:#ffffff">${opts.nome}</strong>! Recebemos um pedido para
      recuperar o acesso à sua conta do Fut Cajazeiras.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#cfcfcf">
      Clique no botão abaixo para criar uma nova senha. O link é válido por <strong style="color:#ffffff">30 minutos</strong>.
    </p>
    <a href="${opts.link}" style="display:block;text-align:center;background:#e6b93f;color:#0d0d0d;text-decoration:none;font-weight:700;padding:14px;border-radius:10px">
      Criar nova senha
    </a>
    <p style="margin:20px 0 0;font-size:12px;color:#8a8a8a">
      Se você não pediu a recuperação, ignore este e-mail. Se precisar de ajuda, fale com a diretoria pelo WhatsApp.
    </p>
  `);
}

/** E-mail com o link de validação de cadastro (primeiro e-mail real). */
export function htmlValidacaoEmail(opts: { nome: string; link: string }): string {
  return shell(`
    <h1 style="margin:0 0 12px;font-size:20px;color:#ffffff">Confirme seu e-mail</h1>
    <p style="margin:0 0 16px;font-size:14px;color:#cfcfcf">
      Olá, <strong style="color:#ffffff">${opts.nome}</strong>! Para liberar o acesso à
      plataforma do Fut Cajazeiras, confirme o seu e-mail.
    </p>
    <p style="margin:0 0 24px;font-size:14px;color:#cfcfcf">
      Clique no botão abaixo para validar seu cadastro e acessar a plataforma.
    </p>
    <a href="${opts.link}" style="display:block;text-align:center;background:#e6b93f;color:#0d0d0d;text-decoration:none;font-weight:700;padding:14px;border-radius:10px">
      Confirmar e-mail
    </a>
    <p style="margin:20px 0 0;font-size:12px;color:#8a8a8a">
      Se você não solicitou, ignore este e-mail.
    </p>
  `);
}
