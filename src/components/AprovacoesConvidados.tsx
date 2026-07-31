import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { pedidosConvidadoPendentesQuery } from "@/lib/babaQueries";
import { decidirPedidoConvidado } from "@/lib/convidados.functions";
import { Check, X, ShieldQuestion } from "lucide-react";

/** Fila de aprovação da diretoria para convidados novos. */
export function AprovacoesConvidados() {
  const qc = useQueryClient();
  const decidir = useServerFn(decidirPedidoConvidado);
  const { data: pedidos } = useQuery(pedidosConvidadoPendentesQuery());

  const acao = useMutation({
    mutationFn: async ({ id, aprovar }: { id: string; aprovar: boolean }) =>
      await decidir({ data: { pedidoId: id, aprovar } }),
    onSuccess: (_r, vars) => {
      toast.success(vars.aprovar ? "Convidado aprovado" : "Convidado recusado");
      qc.invalidateQueries({ queryKey: ["pedidos-convidado-pendentes"] });
      qc.invalidateQueries({ queryKey: ["convidados-da-casa"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const lista = pedidos ?? [];

  return (
    <div className="card-vip p-5">
      <div className="flex items-center gap-2">
        <ShieldQuestion className="size-5 text-gold" />
        <p className="font-display text-lg">Aprovações de convidados</p>
        <Badge variant="outline" className="ml-auto border-gold/40 text-gold">
          {lista.length}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Nenhum PIX é gerado antes da aprovação. Depois de aprovado uma vez, o convidado vira "da casa".
      </p>
      {lista.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido aguardando.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {lista.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{p.convidados_cadastro?.nome ?? "Convidado"}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {p.convidados_cadastro?.telefone} • indicado por {p.nomeAnfitriao}
                </p>
              </div>
              <Button
                variant="success"
                size="icon"
                aria-label="Aprovar convidado"
                disabled={acao.isPending}
                onClick={() => acao.mutate({ id: p.id, aprovar: true })}
              >
                <Check className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Recusar convidado"
                disabled={acao.isPending}
                onClick={() => acao.mutate({ id: p.id, aprovar: false })}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
