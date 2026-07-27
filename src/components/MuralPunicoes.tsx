import { useQuery } from "@tanstack/react-query";
import { suspensoesQuery } from "@/lib/babaQueries";
import { ShieldX } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function MuralPunicoes() {
  const { data: suspensoes, isLoading } = useQuery(suspensoesQuery());
  const lista = suspensoes ?? [];

  return (
    <section className="card-premium p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-gold">Mural de punições</p>
          <h2 className="font-display text-2xl">Suspensos</h2>
        </div>
        <ShieldX className="size-6 text-destructive" />
      </div>

      {isLoading && <p className="mt-3 text-sm text-muted-foreground">Carregando punições...</p>}

      {!isLoading && lista.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">
          Nenhuma punição registrada. Segue o jogo limpo!
        </p>
      )}

      <ul className="mt-3 space-y-2">
        {lista.map((s) => (
          <li key={s.id} className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-sm font-semibold text-foreground">{s.nome}</p>
            <p className="text-xs text-muted-foreground">{s.motivo}</p>
            <p className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground/70">
              registrado em {format(new Date(s.criado_em), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
