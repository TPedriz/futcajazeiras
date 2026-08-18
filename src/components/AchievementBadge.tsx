import { cn } from "@/lib/utils";
import { classesRaridade, rotuloRaridade } from "@/lib/feed";

export interface AchievementBadgeDado {
  id?: string;
  nome: string;
  icone: string;
  cor?: string | null;
  raridade?: string | null;
  descricao?: string | null;
}

/**
 * Emblema de conquista (ícone + nome) com tratamento visual por raridade.
 * Reutilizado no feed, no catálogo e nas seções de destaque do perfil.
 */
export function AchievementBadge({
  conquista,
  desbloqueada = true,
  compacto = false,
  className,
}: {
  conquista: AchievementBadgeDado;
  desbloqueada?: boolean;
  compacto?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-3 py-2",
        classesRaridade(conquista.raridade, desbloqueada),
        compacto && "px-2 py-1",
        className,
      )}
    >
      <span className={cn("leading-none", compacto ? "text-base" : "text-xl")}>
        {conquista.icone}
      </span>
      <div className="min-w-0 text-left leading-tight">
        <p className={cn("truncate font-semibold", compacto ? "text-xs" : "text-sm")}>
          {conquista.nome}
        </p>
        {!compacto && (
          <p className="text-[10px] uppercase tracking-widest opacity-80">
            {rotuloRaridade(conquista.raridade)}
          </p>
        )}
      </div>
    </div>
  );
}
