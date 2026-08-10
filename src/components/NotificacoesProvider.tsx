import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { notificacoesQuery } from "@/lib/babaQueries";
import type { Database } from "@/integrations/supabase/types";

type Notificacao = Database["public"]["Tables"]["notificacoes"]["Row"];

interface ItemCelebracao {
  id: string;
  tipo: "conquista" | "nivel";
  titulo: string;
  mensagem: string;
}

interface NotificacoesContextValue {
  userId: string | undefined;
  notificacoes: Notificacao[];
  naoLidas: Notificacao[];
  marcarTodasLidas: () => Promise<void>;
  marcarLida: (id: string) => Promise<void>;
  filaCelebracao: ItemCelebracao[];
  removerCelebracao: (id: string) => void;
}

const NotificacoesContext = createContext<NotificacoesContextValue | null>(null);

/** Hook de acesso às notificações do usuário logado (usar dentro de <NotificacoesProvider>). */
export function useNotificacoes() {
  const ctx = useContext(NotificacoesContext);
  if (!ctx) throw new Error("useNotificacoes deve ser usado dentro de <NotificacoesProvider>");
  return ctx;
}

// Canal único por montagem: o @supabase/realtime-js deduplica canais pelo topic.
// Se usássemos sempre "notificacoes-usuario" e o provider remontar (ex.: StrictMode
// em dev), o segundo supabase.channel() devolveria o canal ANTIGO já inscrito e o
// .on("postgres_changes") depois do .subscribe() lançaria:
//   "cannot add postgres_changes callbacks for realtime:notificacoes-usuario after subscribe()"
// Sufixo numérico garante um canal novo e livre de colisão a cada montagem.
let contadorCanais = 0;

/**
 * Provedor global de notificações (sino + bolha de celebração).
 *
 * Centraliza a inscrição Realtime do Supabase em UM único canal. Assim o sino pode
 * ser renderizado em qualquer lugar (Header mobile, Sidebar desktop, BottomNav…)
 * SEM nunca criar/duplicar a inscrição — resolvendo o erro de tela em branco
 * causado por chamar .on("postgres_changes") em um canal já com .subscribe() ativo.
 */
export function NotificacoesProvider({
  userId,
  children,
}: {
  userId: string | undefined;
  children: ReactNode;
}) {
  const qc = useQueryClient();
  const [nomeCanal] = useState(() => `notificacoes-usuario-${++contadorCanais}`);
  const { data: notificacoes = [] } = useQuery(notificacoesQuery(userId));
  const [filaCelebracao, setFilaCelebracao] = useState<ItemCelebracao[]>([]);

  // Inscrição Realtime única: .on() ANTES do .subscribe() e cleanup no unmount.
  useEffect(() => {
    if (!userId) return;
    const canal = supabase
      .channel(nomeCanal)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notificacoes",
          filter: `usuario_id=eq.${userId}`,
        },
        (payload) => {
          void qc.invalidateQueries({ queryKey: ["notificacoes", userId] });
          const n = payload.new as Partial<Notificacao> | undefined;
          if (n?.id && (n.tipo === "conquista" || n.tipo === "nivel")) {
            setFilaCelebracao((f) => [
              ...f,
              {
                id: n.id!,
                tipo: n.tipo as "conquista" | "nivel",
                titulo: n.titulo ?? "",
                mensagem: n.mensagem ?? "",
              },
            ]);
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(canal);
    };
  }, [userId, qc, nomeCanal]);

  const naoLidas = notificacoes.filter((n) => !n.lida);

  const marcarLida = useCallback(
    async (id: string) => {
      await supabase.from("notificacoes").update({ lida: true }).eq("id", id);
      await qc.invalidateQueries({ queryKey: ["notificacoes", userId] });
    },
    [qc, userId],
  );

  const marcarTodasLidas = useCallback(async () => {
    if (!userId || naoLidas.length === 0) return;
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("usuario_id", userId)
      .eq("lida", false);
    await qc.invalidateQueries({ queryKey: ["notificacoes", userId] });
  }, [qc, userId, naoLidas.length]);

  const removerCelebracao = useCallback((id: string) => {
    setFilaCelebracao((f) => f.filter((x) => x.id !== id));
  }, []);

  const value = useMemo<NotificacoesContextValue>(
    () => ({
      userId,
      notificacoes,
      naoLidas,
      marcarTodasLidas,
      marcarLida,
      filaCelebracao,
      removerCelebracao,
    }),
    [
      userId,
      notificacoes,
      naoLidas,
      marcarTodasLidas,
      marcarLida,
      filaCelebracao,
      removerCelebracao,
    ],
  );

  return <NotificacoesContext.Provider value={value}>{children}</NotificacoesContext.Provider>;
}
