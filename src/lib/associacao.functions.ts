import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Primeiro dia do mês corrente (referência da mensalidade). */
function referenciaMes(): string {
  const hoje = new Date();
  const mes = `${hoje.getUTCMonth() + 1}`.padStart(2, "0");
  return `${hoje.getUTCFullYear()}-${mes}-01`;
}

export interface ResultadoAssociacao {
  aprovado: boolean;
}

/**
 * Diretoria aprova ou recusa um pedido de associação.
 * Aprovar: promove o convidado a associado e garante a mensalidade do mês
 * (ele passa a poder pagar e virar membro). Recusar: exige justificativa,
 * que é enviada ao usuário na central de notificações.
 */
export const decidirSolicitacaoAssociacao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        solicitacaoId: z.string().uuid(),
        aprovar: z.boolean(),
        justificativa: z.string().trim().default(""),
      })
      .parse(d),
  )
  .handler(async ({ data, context }): Promise<ResultadoAssociacao> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Só a diretoria decide.
    const { data: admin } = await supabaseAdmin
      .from("papeis_usuario")
      .select("user_id")
      .eq("user_id", context.userId)
      .eq("papel", "administrador")
      .maybeSingle();
    if (!admin) throw new Error("Apenas a diretoria pode decidir associações.");

    const { data: sol, error } = await supabaseAdmin
      .from("solicitacoes_associacao")
      .select("id, usuario_id, status")
      .eq("id", data.solicitacaoId)
      .maybeSingle();
    if (error) throw error;
    if (!sol) throw new Error("Solicitação não encontrada.");
    if (sol.status !== "pendente") throw new Error("Essa solicitação já foi decidida.");

    if (!data.aprovar && data.justificativa.length < 5) {
      throw new Error("Escreva uma justificativa para a recusa.");
    }

    const { error: erroUpdate } = await supabaseAdmin
      .from("solicitacoes_associacao")
      .update({
        status: data.aprovar ? "aprovado" : "rejeitado",
        decidido_por: context.userId,
        observacao: data.justificativa,
      })
      .eq("id", sol.id);
    if (erroUpdate) throw erroUpdate;

    if (data.aprovar) {
      await supabaseAdmin.from("papeis_usuario").delete().eq("user_id", sol.usuario_id);
      const { error: erroPapel } = await supabaseAdmin
        .from("papeis_usuario")
        .insert({ user_id: sol.usuario_id, papel: "associado" });
      if (erroPapel) throw erroPapel;

      // Gera a mensalidade do mês para ele já poder pagar e virar membro.
      await supabaseAdmin.rpc("garante_mensalidade", {
        _usuario_id: sol.usuario_id,
        _referencia: referenciaMes(),
      });

      await supabaseAdmin.from("notificacoes").insert({
        usuario_id: sol.usuario_id,
        tipo: "associacao",
        titulo: "Associação aprovada!",
        mensagem:
          "A diretoria aprovou sua associação. Pague a mensalidade para ativar seu status de membro.",
        link: "/pagamentos",
      });
    } else {
      await supabaseAdmin.from("notificacoes").insert({
        usuario_id: sol.usuario_id,
        tipo: "associacao",
        titulo: "Associação não aprovada",
        mensagem: `A diretoria não aprovou sua associação. Motivo: ${data.justificativa}`,
        link: "/perfil",
      });
    }

    return { aprovado: data.aprovar };
  });
