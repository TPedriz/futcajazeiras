import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type FiltroPapel = "todos" | "administrador" | "associado" | "convidado";

export function FiltroCargo({
  valor,
  onChange,
  total,
}: {
  valor: FiltroPapel;
  onChange: (v: FiltroPapel) => void;
  total?: number;
}) {
  return (
    <div className="card-premium flex items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-widest text-gold">Filtrar por cargo</p>
        {total !== undefined && (
          <p className="text-xs text-muted-foreground">{total} {total === 1 ? "pessoa" : "pessoas"}</p>
        )}
      </div>
      <Select value={valor} onValueChange={(v) => onChange(v as FiltroPapel)}>
        <SelectTrigger className="h-10 w-40" aria-label="Filtrar por cargo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="todos">Todos</SelectItem>
          <SelectItem value="associado">Associado</SelectItem>
          <SelectItem value="convidado">Convidado</SelectItem>
          <SelectItem value="administrador">Diretoria</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
