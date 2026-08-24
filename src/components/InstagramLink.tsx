import { Instagram } from "lucide-react";
import { cn } from "@/lib/utils";
import { instagramFormatado, instagramUrl } from "@/lib/redeSocial";

/**
 * @Instagram clicável, discreto e reutilizável.
 * Usado em perfis, rankings, cartinhas e listas sociais.
 */
export function InstagramLink({
  valor,
  className = "",
  compacto = false,
}: {
  valor: string | null | undefined;
  /** Classes extras (ex.: cor/tamanho do texto). */
  className?: string;
  /** Versão ainda mais discreta (só o @). */
  compacto?: boolean;
}) {
  const rotulo = instagramFormatado(valor);
  const url = instagramUrl(valor);
  if (!rotulo || !url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={`Instagram ${rotulo}`}
      className={cn(
        "inline-flex max-w-full shrink-0 items-center gap-1 text-xs text-sky-400/90 transition-colors hover:text-sky-300 hover:underline",
        className,
      )}
    >
      <Instagram className="size-3.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{compacto ? rotulo : rotulo}</span>
    </a>
  );
}
