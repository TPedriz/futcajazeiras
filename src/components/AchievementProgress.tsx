import { CheckCircle2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Barra de progresso de uma conquista (ex.: 6 / 10 pênaltis).
 * Conquistada => barra cheia + "Desbloqueada"; pendente => "Bloqueada".
 */
export function AchievementProgress({
  atual,
  meta,
  desbloqueada,
  rotulo,
}: {
  atual: number;
  meta: number;
  desbloqueada: boolean;
  /** Rótulo curto da ação (ex.: "Defenda 10 pênaltis."). */
  rotulo: string;
}) {
  const progresso = meta > 0 ? Math.min(100, Math.round((atual / meta) * 100)) : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">{rotulo}</span>
        <span className="shrink-0 font-semibold">
          {atual} / {meta}
        </span>
      </div>
      <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            desbloqueada ? "bg-gradient-gold" : "bg-muted-foreground/40",
          )}
          style={{ width: `${progresso}%` }}
        />
      </div>
      <p
        className={cn(
          "mt-1 flex items-center gap-1 text-[11px] font-medium",
          desbloqueada ? "text-gold" : "text-muted-foreground",
        )}
      >
        {desbloqueada ? (
          <>
            <CheckCircle2 className="size-3" /> Desbloqueada
          </>
        ) : (
          <>
            <Lock className="size-3" /> Bloqueada
          </>
        )}
      </p>
    </div>
  );
}
