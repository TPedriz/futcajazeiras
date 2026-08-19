import { useQuery } from "@tanstack/react-query";
import { Target, Users, CalendarClock, HeartHandshake, CheckCircle2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { contribuicoesMetaQuery } from "@/lib/babaQueries";
import {
  formatarReais,
  progressoMeta,
  rotuloCategoriaMeta,
  rotuloStatusMeta,
} from "@/lib/redeSocial";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Meta = Database["public"]["Tables"]["metas"]["Row"];

/**
 * Card de uma meta coletiva: título, categoria, progresso (arrecadado/alvo),
 * prazo e botão de contribuir.
 */
export function MetaCard({
  meta,
  onContribuir,
  mostrarHistorico = true,
}: {
  meta: Meta;
  onContribuir?: (meta: Meta) => void;
  mostrarHistorico?: boolean;
}) {
  const { data: contribuicoes } = useQuery(contribuicoesMetaQuery(meta.id));
  const prog = progressoMeta(meta.valor_arrecadado, meta.valor_alvo);
  const atingida = meta.status === "atingida";
  const encerrada = meta.status === "encerrada";

  const contribuicoesConfirmadas = (contribuicoes ?? []).filter(
    (c) => c.status === "confirmada",
  ).length;

  return (
    <article
      className={cn(
        "card-premium p-4",
        atingida && "border-gold/50 shadow-[0_0_24px_rgba(217,167,86,0.25)]",
        encerrada && "opacity-75",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-lg leading-tight text-foreground">
            <Target className="size-5 shrink-0 text-gold" />
            {meta.titulo}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
            <span className="rounded-full border border-border/50 bg-surface px-2 py-0.5 uppercase tracking-widest text-muted-foreground">
              {rotuloCategoriaMeta(meta.categoria)}
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 uppercase tracking-widest",
                atingida
                  ? "border border-gold/50 bg-gold/15 text-gold"
                  : "border border-border/50 bg-surface text-muted-foreground",
              )}
            >
              {rotuloStatusMeta(meta.status)}
            </span>
          </div>
        </div>
      </div>

      {meta.descricao && (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{meta.descricao}</p>
      )}

      {/* Progresso */}
      <div className="mt-3 space-y-1.5">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-xl text-gold">{formatarReais(prog.arrecadado)}</p>
          <p className="text-xs text-muted-foreground">de {formatarReais(prog.alvo)}</p>
        </div>
        <Progress value={prog.percentual} className={cn("h-3", atingida && "bg-gold/20")} />
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>{prog.percentual}% arrecadado</span>
          {!atingida && prog.restante > 0 && <span>faltam {formatarReais(prog.restante)}</span>}
        </div>
      </div>

      {/* Rodapé */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          {contribuicoesConfirmadas > 0 && (
            <span className="inline-flex items-center gap-1">
              <Users className="size-3.5" />
              {contribuicoesConfirmadas}{" "}
              {contribuicoesConfirmadas === 1 ? "contribuinte" : "contribuintes"}
            </span>
          )}
          {meta.prazo && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              prazo {format(new Date(`${meta.prazo}T12:00:00`), "dd/MM/yyyy", { locale: ptBR })}
            </span>
          )}
        </div>

        {atingida ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-gold">
            <CheckCircle2 className="size-4" /> Meta atingida!
          </span>
        ) : encerrada ? (
          <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground">
            <Lock className="size-4" /> Encerrada
          </span>
        ) : (
          onContribuir && (
            <Button variant="gold" size="sm" onClick={() => onContribuir(meta)}>
              <HeartHandshake className="size-4" /> Contribuir
            </Button>
          )
        )}
      </div>
    </article>
  );
}
