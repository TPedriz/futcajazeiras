import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Bell,
  CheckCheck,
  HandHeart,
  Wallet,
  ShieldX,
  Info,
  ClipboardList,
  UserCog,
  Trophy,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { notificacoesQuery } from "@/lib/babaQueries";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const icones = {
  convidado: HandHeart,
  pagamento: Wallet,
  suspensao: ShieldX,
  associacao: UserCog,
  auditoria: UserCog,
  lista: ClipboardList,
  conquista: Trophy,
  geral: Info,
} as const;

export function SinoNotificacoes({ userId }: { userId: string | undefined }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: notificacoes } = useQuery(notificacoesQuery(userId));

  useEffect(() => {
    if (!userId) return;
    const canal = supabase
      .channel("notificacoes-usuario")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notificacoes", filter: `usuario_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["notificacoes", userId] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [userId, qc]);

  const naoLidas = (notificacoes ?? []).filter((n) => !n.lida);

  const marcarTodas = async () => {
    if (!userId || naoLidas.length === 0) return;
    await supabase
      .from("notificacoes")
      .update({ lida: true })
      .eq("usuario_id", userId)
      .eq("lida", false);
    qc.invalidateQueries({ queryKey: ["notificacoes", userId] });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Notificações${naoLidas.length ? `: ${naoLidas.length} não lidas` : ""}`}
          className="relative flex size-10 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:text-gold"
        >
          <Bell className="size-5" />
          {naoLidas.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
              {naoLidas.length > 9 ? "9+" : naoLidas.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,90vw)] p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <p className="text-xs uppercase tracking-widest text-gold">Notificações</p>
          {naoLidas.length > 0 && (
            <Button variant="ghost" size="sm" onClick={marcarTodas}>
              <CheckCheck className="size-4" /> Marcar lidas
            </Button>
          )}
        </div>
        <ScrollArea type="always" className="max-h-[70vh] min-h-24">
          {(notificacoes ?? []).length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum aviso por aqui ainda.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {(notificacoes ?? []).map((n) => {
                const Icone = icones[(n.tipo as keyof typeof icones) ?? "geral"] ?? Info;
                const abrir = async () => {
                  if (!n.lida) {
                    await supabase.from("notificacoes").update({ lida: true }).eq("id", n.id);
                    qc.invalidateQueries({ queryKey: ["notificacoes", userId] });
                  }
                  if (n.link) navigate({ to: n.link as never });
                };
                return (
                  <li key={n.id} className={n.lida ? "" : "bg-gold/5"}>
                    <button
                      type="button"
                      onClick={abrir}
                      className="flex w-full gap-3 p-3 text-left transition-colors hover:bg-surface"
                    >
                      <Icone
                        className={`mt-0.5 size-4 shrink-0 ${n.lida ? "text-muted-foreground" : "text-gold"}`}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{n.titulo}</p>
                        <p className="text-xs text-muted-foreground">{n.mensagem}</p>
                        <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">
                          {formatDistanceToNow(new Date(n.criado_em), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
