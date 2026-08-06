import { useQuery } from "@tanstack/react-query";
import { rankingDoMesQuery, mesReferencia } from "@/lib/babaQueries";
import {
  destaquesDoUsuario,
  iconeDestaque,
  ROTULOS_DESTAQUE,
  type Destaque,
} from "@/lib/gamificacao";
import { Medal } from "lucide-react";

const CORES: Record<number, string> = {
  1: "border-gold/60 bg-gold/15 text-gold",
  2: "border-slate-300/50 bg-slate-300/10 text-slate-200",
  3: "border-amber-600/50 bg-amber-600/10 text-amber-500",
};

const MEDALHA: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

interface BadgeDestaqueProps {
  usuarioId: string | undefined;
  /** Quantos primeiros contam como destaque (default 3). */
  top?: number;
  /** Mostra como pill com medalha (default true). */
  compacto?: boolean;
}

/**
 * Badges de destaque do mês exibidos ao lado do nome do usuário.
 * Ex.: 🥇 Gols · 🥈 Assistências
 */
export function BadgeDestaque({ usuarioId, top = 3, compacto = true }: BadgeDestaqueProps) {
  const referencia = mesReferencia();
  const { data, isLoading } = useQuery(rankingDoMesQuery(referencia));

  if (isLoading || !data) return null;
  const destaques = destaquesDoUsuario(data, usuarioId, top);
  if (destaques.length === 0) return null;

  if (compacto) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        {destaques.map((d) => (
          <span
            key={d.categoria}
            title={`${d.posicao}º em ${ROTULOS_DESTAQUE[d.categoria]} do mês`}
            className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${CORES[d.posicao] ?? "border-border bg-muted text-muted-foreground"}`}
          >
            <span>{MEDALHA[d.posicao] ?? d.posicao}</span>
            {iconeDestaque(d.categoria)}
          </span>
        ))}
      </span>
    );
  }

  return (
    <span className="inline-flex flex-wrap gap-1">
      {destaques.map((d) => (
        <span
          key={d.categoria}
          className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold ${CORES[d.posicao] ?? "border-border bg-muted text-muted-foreground"}`}
        >
          <Medal className="size-3.5" />
          {ROTULOS_DESTAQUE[d.categoria]}: {d.posicao}º ({d.valor})
        </span>
      ))}
    </span>
  );
}

export { destaquesDoUsuario, ROTULOS_DESTAQUE };
export type { Destaque };
