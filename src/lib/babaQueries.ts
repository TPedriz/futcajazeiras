import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const perfilAtualQuery = () =>
  queryOptions({
    queryKey: ["perfil-atual"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const [{ data: perfil }, { data: papeis }] = await Promise.all([
        supabase.from("perfis").select("*").eq("id", userData.user.id).maybeSingle(),
        supabase.from("papeis_usuario").select("papel").eq("user_id", userData.user.id),
      ]);

      return {
        user: userData.user,
        perfil,
        isAdmin: (papeis ?? []).some((p) => p.papel === "administrador"),
      };
    },
  });

export const proximaSessaoQuery = () =>
  queryOptions({
    queryKey: ["proxima-sessao"],
    queryFn: async () => {
      const agora = new Date().toISOString();
      const { data, error } = await supabase
        .from("sessoes_baba")
        .select("*")
        .gte("data_horario", agora)
        .order("data_horario", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

export const presencasDaSessaoQuery = (babaId: string | undefined) =>
  queryOptions({
    queryKey: ["presencas", babaId],
    enabled: !!babaId,
    queryFn: async () => {
      if (!babaId) return [];
      const { data, error } = await supabase
        .from("presencas")
        .select(`
          id, baba_id, usuario_id, nome_convidado, status_convidado, confirmado_em,
          perfis:usuario_id ( id, nome, posicao )
        `)
        .eq("baba_id", babaId)
        .order("confirmado_em", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const todasSessoesQuery = () =>
  queryOptions({
    queryKey: ["sessoes-todas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessoes_baba")
        .select("*")
        .order("data_horario", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

export const todosAssociadosQuery = () =>
  queryOptions({
    queryKey: ["associados-todos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis")
        .select("*")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
