import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  conquistasQuery,
  minhasConquistasQuery,
  totaisConquistasQuery,
  type TotaisConquistas,
} from "@/lib/babaQueries";
import { rotuloCategoriaConquista, type Conquista } from "@/lib/gamificacao";
import { RARIDADES, ROTULOS_RARIDADE, rotuloRaridade } from "@/lib/feed";
import { AchievementProgress } from "@/components/AchievementProgress";
import { AchievementRarity } from "@/components/AchievementRarity";
import { Lock } from "lucide-react";

type FiltroRaridade = "todas" | (typeof RARIDADES)[number];

const FILTROS: { valor: FiltroRaridade; rotulo: string }[] = [
  { valor: "todas", rotulo: "Todas" },
  ...RARIDADES.map((r) => ({ valor: r as FiltroRaridade, rotulo: ROTULOS_RARIDADE[r] })),
];

/** Valor atual do usuário em cada categoria (espelha verifica_conquistas do banco). */
function valorDaCategoria(categoria: string, t: TotaisConquistas): number | null {
  switch (categoria) {
    case "presenca":
      return t.presencas;
    case "gols":
      return t.gols;
    case "assistencias":
      return t.assistencias;
    case "penaltis":
      return t.penaltisDefendidos;
    case "vitorias":
      return t.vitorias;
    case "cartoes":
      return t.cartoesAmarelos;
    case "cartoes_vermelhos":
      return t.cartoesVermelhos;
    case "faltas":
      return t.faltas;
    case "gols_contra":
      return t.golsContra;
    case "nivel":
      return t.nivel;
    case "xp":
      return t.xp;
    default:
      return null;
  }
}

/**
 * Catálogo de conquistas com filtro por raridade e progresso real do usuário.
 */
export function AchievementCatalog({ usuarioId }: { usuarioId: string | undefined }) {
  const [filtro, setFiltro] = useState<FiltroRaridade>("todas");
  const { data: catalogo } = useQuery(conquistasQuery());
  const { data: minhas } = useQuery(minhasConquistasQuery(usuarioId));
  const { data: totais } = useQuery(totaisConquistasQuery(usuarioId));

  const desbloqueadas = new Set((minhas ?? []).map((m) => m.conquista_id));

  const filtradas = (catalogo ?? []).filter((c) => filtro === "todas" || c.raridade === filtro);

  const agrupadas = new Map<string, Conquista[]>();
  for (const c of filtradas) {
    const lista = agrupadas.get(c.categoria) ?? [];
    lista.push(c);
    agrupadas.set(c.categoria, lista);
  }

  return (
    <div className="space-y-4">
      {/* Filtros por raridade */}
      <div className="flex flex-wrap gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setFiltro(f.valor)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filtro === f.valor
                ? "border-gold/60 bg-gold/10 text-gold"
                : "border-border/60 bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            {f.rotulo}
          </button>
        ))}
      </div>

      {agrupadas.size === 0 ? (
        <div className="card-premium p-6 text-center">
          <p className="font-display text-xl text-muted-foreground">
            Nenhuma conquista nesta raridade ainda.
          </p>
        </div>
      ) : (
        Array.from(agrupadas.entries()).map(([categoria, conquistas]) => (
          <div key={categoria} className="space-y-2">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              {rotuloCategoriaConquista(categoria)}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {conquistas.map((c) => {
                const desbloqueada = desbloqueadas.has(c.id);
                const atual = totais ? valorDaCategoria(c.categoria, totais) : null;
                const podeProgresso = atual != null && c.categoria !== "historica";
                return (
                  <div
                    key={c.id}
                    className={cn(
                      "rounded-xl border p-3",
                      desbloqueada ? "border-gold/40 bg-gold/5" : "border-border/50 bg-surface/50",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-lg border text-xl",
                          desbloqueada
                            ? "border-gold/40 bg-gold/10"
                            : "border-border/50 bg-muted/40 grayscale opacity-50",
                        )}
                      >
                        {c.icone}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{c.nome}</p>
                        <AchievementRarity raridade={c.raridade} />
                      </div>
                      {!desbloqueada && <Lock className="size-4 shrink-0 text-muted-foreground" />}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">{c.descricao}</p>
                    {podeProgresso && (
                      <div className="mt-2">
                        <AchievementProgress
                          atual={Math.min(atual!, c.meta)}
                          meta={c.meta}
                          desbloqueada={desbloqueada}
                          rotulo={
                            desbloqueada
                              ? `Desbloqueada em ${rotuloRaridade(c.raridade)}`
                              : c.descricao
                          }
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
