import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  conquistasQuery,
  minhasConquistasQuery,
  conquistasEmDestaqueQuery,
} from "@/lib/babaQueries";
import { rotuloCategoriaConquista, type Conquista } from "@/lib/gamificacao";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sparkles, Lock } from "lucide-react";

/** Máximo de conquistas que um usuário pode destacar. */
export const MAX_DESTAQUES = 3;

/**
 * Cores de brilho (glow) por tema da conquista — usadas apenas quando a
 * conquista está desbloqueada. Bloqueadas ficam opacas/cinzas.
 */
const CORES_CONQUISTA: Record<string, string> = {
  gold: "border-gold/50 bg-gold/10 text-gold shadow-[0_0_18px_rgba(201,162,39,0.35)]",
  amber:
    "border-amber-400/50 bg-amber-400/10 text-amber-300 shadow-[0_0_18px_rgba(251,191,36,0.35)]",
  sky: "border-sky-400/50 bg-sky-400/10 text-sky-300 shadow-[0_0_18px_rgba(56,189,248,0.35)]",
  violet:
    "border-violet-400/50 bg-violet-400/10 text-violet-300 shadow-[0_0_18px_rgba(167,139,250,0.35)]",
  rose: "border-rose-400/50 bg-rose-400/10 text-rose-300 shadow-[0_0_18px_rgba(251,113,133,0.35)]",
};

function corConquista(cor: string): string {
  return CORES_CONQUISTA[cor] ?? CORES_CONQUISTA.gold;
}

/** Grid "Minhas Conquistas": desbloqueadas em cor/brilho, bloqueadas cinza, destaque até 3. */
export function GerenciadorConquistas({ usuarioId }: { usuarioId: string | undefined }) {
  const qc = useQueryClient();
  const { data: catalogo } = useQuery(conquistasQuery());
  const { data: minhas } = useQuery(minhasConquistasQuery(usuarioId));

  const desbloqueadas = new Map((minhas ?? []).map((m) => [m.conquista_id, m]));
  const destaques = (minhas ?? []).filter((m) => m.em_destaque);

  const alternarDestaque = async (conquista: Conquista, emDestaque: boolean) => {
    if (!usuarioId) return;
    const vinculo = desbloqueadas.get(conquista.id);
    if (!vinculo) return;

    if (emDestaque && destaques.length >= MAX_DESTAQUES) {
      toast.error("Limite de destaques", {
        description: `Você já destacou ${MAX_DESTAQUES} conquistas. Remova uma antes de destacar outra.`,
      });
      return;
    }

    // Preenche o menor slot livre (1..3) para manter a ordem dos destaques.
    const slotsUsados = new Set(destaques.map((d) => d.ordem_destaque ?? 0));
    let proximaOrdem: number | null = null;
    if (emDestaque) {
      for (let i = 1; i <= MAX_DESTAQUES; i++) {
        if (!slotsUsados.has(i)) {
          proximaOrdem = i;
          break;
        }
      }
      if (proximaOrdem === null) {
        proximaOrdem = Math.max(0, ...destaques.map((d) => d.ordem_destaque ?? 0)) + 1;
      }
    }

    const { error } = await supabase
      .from("usuario_conquistas")
      .update({ em_destaque: emDestaque, ordem_destaque: proximaOrdem })
      .eq("id", vinculo.id);
    if (error) {
      toast.error("Não foi possível atualizar o destaque", { description: error.message });
      return;
    }
    toast.success(emDestaque ? "Conquista em destaque!" : "Destaque removido");
    qc.invalidateQueries({ queryKey: ["minhas-conquistas", usuarioId] });
    qc.invalidateQueries({ queryKey: ["conquistas-em-destaque"] });
  };

  const agrupadas = new Map<string, Conquista[]>();
  for (const c of catalogo ?? []) {
    const lista = agrupadas.get(c.categoria) ?? [];
    lista.push(c);
    agrupadas.set(c.categoria, lista);
  }

  return (
    <div className="space-y-4">
      {Array.from(agrupadas.entries()).map(([categoria, conquistas]) => (
        <div key={categoria} className="space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {rotuloCategoriaConquista(categoria)}
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {conquistas.map((c) => {
              const vinculo = desbloqueadas.get(c.id);
              const desbloqueada = !!vinculo;
              const emDestaque = vinculo?.em_destaque ?? false;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={!desbloqueada}
                  title={
                    desbloqueada
                      ? emDestaque
                        ? "Toque para remover do destaque"
                        : "Toque para destacar (aparece ao lado do seu nome)"
                      : `Bloqueada — ${c.descricao}`
                  }
                  onClick={() => alternarDestaque(c, !emDestaque)}
                  className={`group flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all ${
                    desbloqueada
                      ? `cursor-pointer ${emDestaque ? corConquista(c.cor) + " ring-2 ring-gold/70" : corConquista(c.cor) + " hover:scale-[1.03]"}`
                      : "cursor-not-allowed border-border/50 bg-muted/40 opacity-45 grayscale"
                  }`}
                >
                  <span className={`text-2xl ${desbloqueada ? "" : "grayscale"}`}>{c.icone}</span>
                  <span className="text-xs font-semibold leading-tight">{c.nome}</span>
                  {desbloqueada ? (
                    <span className="flex items-center gap-1 text-[10px] text-foreground/70">
                      <Sparkles className="size-3" />
                      {emDestaque ? `Destaque ${vinculo?.ordem_destaque ?? ""}`.trim() : "Destacar"}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Lock className="size-3" /> Bloqueada
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {catalogo && catalogo.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Toque em até {MAX_DESTAQUES} conquistas desbloqueadas para destacá-las ao lado do seu nome
          em todo o app.
        </p>
      )}
    </div>
  );
}
