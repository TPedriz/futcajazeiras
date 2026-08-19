import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

/**
 * Nome de jogador clicável que abre o perfil público (/perfil/:id).
 * Usado no feed, rankings, conquistas, TOTW e listas sociais.
 */
export function LinkPerfilJogador({
  id,
  children,
  className = "",
  onClick,
}: {
  id: string | undefined | null;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  if (!id) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link
      to="/perfil/$id"
      params={{ id }}
      onClick={onClick}
      className={cn(
        "rounded-sm outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-gold/60",
        className,
      )}
    >
      {children}
    </Link>
  );
}
