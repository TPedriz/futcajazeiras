import { useQuery } from "@tanstack/react-query";
import { conquistasEmDestaqueQuery } from "@/lib/babaQueries";

/**
 * Micro-badges de conquistas em destaque de um usuário (até 3).
 *
 * Usa a query compartilhada `conquistasEmDestaqueQuery`, que carrega os
 * destaques de todos os usuários de uma vez — ideal para listas (ranking,
 * times sorteados e presenças) sem estourar o número de requisições.
 *
 * Retorna `null` quando o usuário não tem conquista em destaque.
 */
export function MicroConquistas({
  usuarioId,
  size = "sm",
}: {
  usuarioId?: string | null;
  size?: "sm" | "lg";
}) {
  const { data: mapa } = useQuery(conquistasEmDestaqueQuery());
  const destaques = (usuarioId && mapa?.get(usuarioId)) ?? [];

  if (!usuarioId || destaques.length === 0) return null;

  const base = size === "lg" ? "text-lg" : "text-[13px]";
  return (
    <span className="inline-flex shrink-0 items-center gap-0.5" aria-label="Conquistas em destaque">
      {destaques.slice(0, 3).map((c) => (
        <span
          key={c.id}
          title={`${c.nome} (conquista em destaque)`}
          className={`${base} drop-shadow-[0_0_6px_rgba(201,162,39,0.55)]`}
        >
          {c.icone}
        </span>
      ))}
    </span>
  );
}
