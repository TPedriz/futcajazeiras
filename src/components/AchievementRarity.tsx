import { cn } from "@/lib/utils";
import { iconeRaridade, rotuloRaridade } from "@/lib/feed";

/**
 * Rótulo visual de raridade de uma conquista.
 * Usa o design system (tokens semânticos + glow) — nunca cores arbitrárias.
 */
export function AchievementRarity({
  raridade,
  className,
}: {
  raridade?: string | null;
  className?: string;
}) {
  const cor =
    raridade === "lendaria" || raridade === "mitica"
      ? "text-gold"
      : raridade === "epica"
        ? "text-violet-300"
        : raridade === "rara"
          ? "text-blue-400"
          : raridade === "incomum"
            ? "text-sky-300"
            : "text-muted-foreground";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider",
        cor,
        className,
      )}
    >
      <span className="text-xs leading-none">{iconeRaridade(raridade)}</span>
      {rotuloRaridade(raridade)}
    </span>
  );
}
