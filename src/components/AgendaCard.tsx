import { CalendarDays, Clock, MapPin, Users, ShieldX } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { formatarHora, rotuloCategoriaEvento, rotuloStatusEvento } from "@/lib/redeSocial";
import type { Database } from "@/integrations/supabase/types";

type EventoArena = Database["public"]["Tables"]["arena_eventos"]["Row"];

/**
 * Card de um evento da Agenda dos Babas (Arena Cajazeiras).
 * Funciona na landing (público) e na agenda completa.
 */
export function AgendaCard({ evento }: { evento: EventoArena }) {
  const cancelado = evento.status === "cancelado";
  const concluido = evento.status === "concluido";

  return (
    <article
      className={cn(
        "card-premium p-4 transition-colors",
        cancelado && "opacity-60",
        concluido && "opacity-75",
      )}
    >
      <div className="flex items-start gap-3">
        {/* Data (dia + mês) */}
        <div
          className={cn(
            "flex w-14 shrink-0 flex-col items-center rounded-xl border p-1.5 text-center",
            cancelado ? "border-border/40 bg-muted/40" : "border-gold/40 bg-gold/5",
          )}
        >
          <span className="font-display text-2xl leading-none text-gold">
            {format(new Date(`${evento.data_evento}T12:00:00`), "dd")}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {format(new Date(`${evento.data_evento}T12:00:00`), "MMM", { locale: ptBR })}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-lg leading-tight text-foreground">{evento.titulo}</h3>
            {cancelado && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-destructive">
                <ShieldX className="size-3" /> Cancelado
              </span>
            )}
            {concluido && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border/50 bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Concluído
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {format(new Date(`${evento.data_evento}T12:00:00`), "EEEE, dd 'de' MMMM", {
                locale: ptBR,
              })}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" />
              {formatarHora(evento.hora_inicio)}
              {evento.hora_fim ? `–${formatarHora(evento.hora_fim)}` : ""}
            </span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-3.5" />
              {evento.local}
            </span>
            {evento.vagas != null && (
              <span className="inline-flex items-center gap-1">
                <Users className="size-3.5" />
                {evento.vagas} vagas
              </span>
            )}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full border border-border/50 bg-surface px-2 py-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {rotuloCategoriaEvento(evento.categoria)}
            </span>
            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
              Organização:{" "}
              <strong className="font-semibold text-foreground">{evento.organizador}</strong>
            </span>
          </div>

          {evento.descricao && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{evento.descricao}</p>
          )}
        </div>
      </div>
    </article>
  );
}
