// Registro manual no log de auditoria. Somente servidor.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Json } from "@/integrations/supabase/types";
import type { MudancaLog } from "@/lib/logs";

export interface RegistroLog {
  acao: string;
  categoria: string;
  descricao: string;
  entidade?: string;
  entidadeId?: string | null;
  /** Jogador afetado (para filtrar "o que aconteceu com fulano"). */
  alvoId?: string | null;
  alvoNome?: string | null;
  mudancas?: MudancaLog[];
  detalhes?: Record<string, unknown>;
  metodoPagamento?: string | null;
  /** Quem fez a ação (a diretoria, no caso do painel). */
  atorId?: string | null;
}

/**
 * Grava um registro no log de auditoria (`public.logs_auditoria`).
 *
 * Usado quando a ação não passa por nenhuma tabela observada — exclusão de
 * conta, senha temporária, correção de e-mail. Nunca lança: auditoria não pode
 * derrubar a ação do usuário.
 */
export async function registrarLog(registro: RegistroLog): Promise<void> {
  try {
    await supabaseAdmin.rpc("registra_log", {
      _acao: registro.acao,
      _categoria: registro.categoria,
      _descricao: registro.descricao,
      _entidade: registro.entidade ?? "sistema",
      _entidade_id: registro.entidadeId ?? undefined,
      _alvo_id: registro.alvoId ?? undefined,
      _alvo_nome: registro.alvoNome ?? undefined,
      _mudancas: (registro.mudancas ?? []) as unknown as Json,
      _detalhes: (registro.detalhes ?? {}) as unknown as Json,
      _metodo_pagamento: registro.metodoPagamento ?? undefined,
      _ator_id: registro.atorId ?? undefined,
    });
  } catch (e) {
    console.error("[auditoria] falha ao registrar log", e);
  }
}

/** Busca nome de um perfil (para usar como `alvoNome` no log). */
export async function nomeDoPerfil(usuarioId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("perfis")
    .select("nome")
    .eq("id", usuarioId)
    .maybeSingle();
  return data?.nome ?? null;
}
