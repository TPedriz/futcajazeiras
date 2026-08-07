// Server functions de recuperação de senha, validação de e-mail e senhas
// temporárias. Somente servidor — nada aqui vaza para o bundle do cliente.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createHash, randomBytes, randomInt } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizaTelefone } from "@/lib/telefone";
import { emailReal, emailSintetico } from "@/lib/email";
import { enviarEmail, htmlRecuperacaoSenha, htmlValidacaoEmail, urlBase } from "@/lib/email.server";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** ID do desenvolvedor autorizado a gerar senhas temporárias (regra estrita). */
export function idDesenvolvedor(): string {
  const id = process.env.DEV_USER_ID;
  if (!id) throw new Error("DEV_USER_ID não configurado");
  return id;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function gerarSenhaForte(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let senha = "";
  for (let i = 0; i < 10; i++) senha += chars[randomInt(chars.length)];
  return senha;
}

export interface ResultadoRecuperacao {
  status: "enviado" | "sem_email" | "nao_encontrado";
}

/** 1) "Esqueci minha senha": busca por telefone e envia link via Resend. */
export const solicitarRecuperacaoSenha = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ telefone: z.string() }).parse(d))
  .handler(async ({ data }): Promise<ResultadoRecuperacao> => {
    const tel = normalizaTelefone(data.telefone);
    if (!tel) return { status: "nao_encontrado" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: perfil } = await supabaseAdmin
      .from("perfis")
      .select("id, nome, email")
      .eq("telefone", tel)
      .maybeSingle();

    if (!perfil) return { status: "nao_encontrado" };

    const contato = emailReal(perfil.email);
    // Cadastro antigo sem e-mail real: bloqueia e orienta a falar com a diretoria.
    if (!contato) return { status: "sem_email" };

    // Gera o link de recuperação para o e-mail de LOGIN (sintético do Auth) e
    // entrega o link no e-mail real de contato via Resend.
    const { data: usuario } = await supabaseAdmin.auth.admin.getUserById(perfil.id);
    if (!usuario?.user?.email) return { status: "sem_email" };

    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: usuario.user.email,
      options: { redirectTo: `${urlBase()}/recuperar-senha` },
    });
    if (linkError || !linkData?.properties?.hashed_token) return { status: "sem_email" };

    const link = `${urlBase()}/recuperar-senha?token_hash=${encodeURIComponent(
      linkData.properties.hashed_token,
    )}&type=recovery`;

    await enviarEmail({
      to: contato,
      subject: "Recuperação de senha — Fut Cajazeiras",
      html: htmlRecuperacaoSenha({ nome: perfil.nome, link }),
    });

    return { status: "enviado" };
  });

export interface ResultadoVerificacao {
  status: "enviado";
  email: string;
}

/** 3) Tela "atualizar-cadastro": valida e-mail e envia link de confirmação via Resend. */
export const solicitarVerificacaoEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string() }).parse(d))
  .handler(async ({ data, context }): Promise<ResultadoVerificacao> => {
    const email = data.email.trim().toLowerCase();
    if (!EMAIL_VALIDO.test(email)) throw new Error("Informe um e-mail válido.");
    if (emailSintetico(email))
      throw new Error("Informe um e-mail real (não o gerado pelo WhatsApp).");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Não deixa usar um e-mail que já pertence a outro perfil.
    const { data: usado } = await supabaseAdmin
      .from("perfis")
      .select("id")
      .eq("email", email)
      .neq("id", context.userId)
      .maybeSingle();
    if (usado) throw new Error("Este e-mail já está cadastrado para outro usuário.");

    // Grava o e-mail (ainda não confirmado) e cria o token de verificação.
    await supabaseAdmin
      .from("perfis")
      .update({ email, email_confirmado: false })
      .eq("id", context.userId);

    const token = randomBytes(32).toString("base64url");
    await supabaseAdmin.from("verificacoes_email").insert({
      usuario_id: context.userId,
      email,
      token_hash: hashToken(token),
      tipo: "email",
      expira_em: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });

    const { data: perfil } = await supabaseAdmin
      .from("perfis")
      .select("nome")
      .eq("id", context.userId)
      .maybeSingle();

    const link = `${urlBase()}/api/auth/confirmar-email?token=${encodeURIComponent(token)}`;
    await enviarEmail({
      to: email,
      subject: "Confirme seu e-mail — Fut Cajazeiras",
      html: htmlValidacaoEmail({ nome: perfil?.nome ?? "Jogador", link }),
    });

    return { status: "enviado", email };
  });

export type ResultadoSenhaTemporaria =
  { ok: true; senha: string } | { ok: false; motivo: "forbidden" | "erro" };

/** 2) Painel Super-Admin: gera senha temporária. Só o desenvolvedor (ID exato). */
export const gerarSenhaTemporaria = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ usuarioId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<ResultadoSenhaTemporaria> => {
    // Regra de segurança estrita: match exato com o ID do desenvolvedor.
    if (context.userId !== idDesenvolvedor()) {
      return { ok: false, motivo: "forbidden" };
    }

    const senha = gerarSenhaForte();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.usuarioId, {
      password: senha,
    });
    if (error) {
      console.error("[auth-admin] falha ao gerar senha temporária", error);
      return { ok: false, motivo: "erro" };
    }
    return { ok: true, senha };
  });
