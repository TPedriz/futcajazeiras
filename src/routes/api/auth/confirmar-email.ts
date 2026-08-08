import { createFileRoute } from "@tanstack/react-router";
import { createHash } from "node:crypto";

// Rota pública clicada no e-mail de confirmação (Resend). Valida o token,
// marca o e-mail como confirmado e mostra uma página de sucesso.

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function pagina(titulo: string, mensagem: string, ok: boolean): Response {
  const base = process.env.APP_PUBLIC_URL || "https://futcajazeiras.com.br";
  const cor = ok ? "#e6b93f" : "#ef4444";
  return new Response(
    `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${titulo} — Fut Cajazeiras</title>
  </head>
  <body style="margin:0;background:#0d0d0d;font-family:Inter,Arial,sans-serif;color:#f5f5f5;display:flex;align-items:center;justify-content:center;min-height:100vh">
    <div style="max-width:420px;margin:0 auto;padding:32px 20px;text-align:center">
      <div style="font-family:'Bebas Neue',Arial,sans-serif;font-size:26px;letter-spacing:2px;color:#e6b93f;margin-bottom:20px">FUT CAJAZEIRAS</div>
      <div style="background:#1a1a1a;border:1px solid #2c2c2c;border-radius:14px;padding:28px">
        <h1 style="margin:0 0 10px;font-size:20px;color:${cor}">${titulo}</h1>
        <p style="margin:0 0 22px;font-size:14px;color:#cfcfcf;line-height:1.5">${mensagem}</p>
        <a href="${base}/inicio" style="display:block;text-align:center;background:#e6b93f;color:#0d0d0d;text-decoration:none;font-weight:700;padding:14px;border-radius:10px">Acessar a plataforma</a>
      </div>
    </div>
  </body>
</html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

export const Route = createFileRoute("/api/auth/confirmar-email")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token") ?? "";
        if (!token)
          return pagina(
            "Link inválido",
            "O link de confirmação é inválido ou está incompleto.",
            false,
          );

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: verif } = await supabaseAdmin
          .from("verificacoes_email")
          .select("*")
          .eq("token_hash", hashToken(token))
          .maybeSingle();

        if (!verif)
          return pagina(
            "Link inválido",
            "Este link de confirmação não foi encontrado. Solicite um novo e-mail de confirmação no aplicativo.",
            false,
          );

        if (verif.usado_em)
          return pagina(
            "E-mail já confirmado",
            "Seu e-mail já foi confirmado. Você já pode acessar a plataforma.",
            true,
          );

        if (new Date(verif.expira_em).getTime() < Date.now())
          return pagina(
            "Link expirado",
            "Este link expirou. Solicite um novo e-mail de confirmação no aplicativo.",
            false,
          );

        await supabaseAdmin
          .from("perfis")
          .update({ email: verif.email, email_confirmado: true })
          .eq("id", verif.usuario_id);

        const agora = new Date().toISOString();
        await supabaseAdmin
          .from("verificacoes_email")
          .update({ usado_em: agora })
          .eq("id", verif.id);
        // Invalida os demais tokens pendentes do mesmo usuário.
        await supabaseAdmin
          .from("verificacoes_email")
          .update({ usado_em: agora })
          .eq("usuario_id", verif.usuario_id)
          .is("usado_em", null);

        return pagina(
          "E-mail confirmado!",
          "Seu e-mail foi confirmado com sucesso. Clique abaixo para acessar a plataforma e voltar ao jogo.",
          true,
        );
      },
    },
  },
});
