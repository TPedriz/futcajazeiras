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

      const lista = (papeis ?? []).map((p) => p.papel);
      const isAdmin = lista.includes("administrador");
      return {
        user: userData.user,
        perfil,
        papeis: lista,
        isAdmin,
        isAssociado: isAdmin || lista.includes("associado"),
        isConvidado: !isAdmin && !lista.includes("associado"),
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
      const { data: presencas, error } = await supabase
        .from("presencas")
        .select("id, baba_id, usuario_id, nome_convidado, status_convidado, confirmado_em, mp_status, valor")
        .eq("baba_id", babaId)
        .order("confirmado_em", { ascending: true });
      if (error) throw error;

      const ids = Array.from(
        new Set((presencas ?? []).map((p) => p.usuario_id).filter(Boolean)),
      ) as string[];
      const mapa = new Map<string, { id: string; nome: string; posicao: "linha" | "goleiro" }>();
      if (ids.length > 0) {
        const { data: perfis } = await (supabase as unknown as {
          from: (t: string) => {
            select: (c: string) => {
              in: (col: string, vals: string[]) => Promise<{ data: { id: string; nome: string; posicao: "linha" | "goleiro" }[] | null }>;
            };
          };
        }).from("perfis_publicos").select("id, nome, posicao").in("id", ids);
        for (const p of perfis ?? []) mapa.set(p.id, p);
      }

      return (presencas ?? []).map((p) => ({
        ...p,
        perfis: p.usuario_id ? mapa.get(p.usuario_id) ?? null : null,
      }));
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

export const mesReferencia = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

export const minhasMensalidadesQuery = (userId: string | undefined) =>
  queryOptions({
    queryKey: ["mensalidades-minhas", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      await supabase.rpc("garante_mensalidades_mes");
      const { data, error } = await supabase
        .from("mensalidades")
        .select("*")
        .eq("usuario_id", userId)
        .order("referencia", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

export const mensalidadesDoMesQuery = (referencia: string) =>
  queryOptions({
    queryKey: ["mensalidades-mes", referencia],
    queryFn: async () => {
      await supabase.rpc("garante_mensalidades_mes");
      const { data, error } = await supabase
        .from("mensalidades")
        .select("*")
        .eq("referencia", referencia);
      if (error) throw error;
      return data ?? [];
    },
  });

export const rankingDoMesQuery = (referencia: string) =>
  queryOptions({
    queryKey: ["ranking-mes", referencia],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ranking_mensal")
        .select("*")
        .eq("mes", referencia);
      if (error) throw error;
      return data ?? [];
    },
  });

export const papeisTodosQuery = () =>
  queryOptions({
    queryKey: ["papeis-todos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("papeis_usuario").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

export const timesDoBabaQuery = (babaId: string | undefined) =>
  queryOptions({
    queryKey: ["times-baba", babaId],
    enabled: !!babaId,
    queryFn: async () => {
      if (!babaId) return [];
      const { data, error } = await supabase
        .from("times_baba")
        .select("id, baba_id, nome, resultado, times_jogadores(id, usuario_id, nome_convidado, posicao)")
        .eq("baba_id", babaId)
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

export const estatisticasDoBabaQuery = (babaId: string | undefined) =>
  queryOptions({
    queryKey: ["estatisticas-baba", babaId],
    enabled: !!babaId,
    queryFn: async () => {
      if (!babaId) return [];
      const { data, error } = await supabase
        .from("estatisticas_baba")
        .select("*")
        .eq("baba_id", babaId);
      if (error) throw error;
      return data ?? [];
    },
  });

export const perfisPublicosQuery = () =>
  queryOptions({
    queryKey: ["perfis-publicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis_publicos")
        .select("id, nome, posicao")
        .order("nome", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
