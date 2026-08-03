import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { solicitacoesRecebidasQuery } from "@/lib/babaQueries";
import { responderSolicitacao } from "@/lib/convidados.functions";
import { Check, X, Inbox } from "lucide-react";

export function SolicitacoesRecebidas({ babaId, userId }: { babaId: string; userId: string }) {
  const qc = useQueryClient();
  const responder = useServerFn(responderSolicitacao);
  const { data: solicitacoes } = useQuery(solicitacoesRecebidasQuery(userId, babaId));

  const acao = useMutation({
    mutationFn: async ({ id, aceitar }: { id: string; aceitar: boolean }) =>
      await responder({ data: { solicitacaoId: id, aceitar } }),
    onSuccess: (r, vars) => {
      toast.success(
        vars.aceitar
          ? r.aguardandoDiretoria
            ? "Convite aceito — aguardando a diretoria"
            : "Convite aceito! O PIX já foi gerado para o convidado."
          : "Solicitação recusada",
        vars.aceitar && r.aguardandoDiretoria
          ? {
              description:
                "Convidado novo vai para a aprovação da diretoria. Depois gere o PIX em 'Levar convidado'.",
            }
          : undefined,
      );
      qc.invalidateQueries({ queryKey: ["solicitacoes-recebidas"] });
      qc.invalidateQueries({ queryKey: ["presencas", babaId] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const pendentes = (solicitacoes ?? []).filter((s) => s.status === "pendente");
  if (pendentes.length === 0) return null;

  return (
    <div className="card-vip p-5">
      <div className="flex items-center gap-2">
        <Inbox className="size-5 text-gold" />
        <p className="font-display text-lg">Pedidos de convidados</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Convidado da casa libera o PIX na hora; convidado novo passa pela aprovação da diretoria
        antes de qualquer cobrança.
      </p>
      <ul className="mt-3 space-y-2">
        {pendentes.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{s.nomeSolicitante}</p>
              <Badge variant="outline" className="mt-1 border-gold/40 text-gold">
                Aguardando você
              </Badge>
            </div>
            <Button
              variant="success"
              size="icon"
              aria-label="Aceitar convidado"
              disabled={acao.isPending}
              onClick={() => acao.mutate({ id: s.id, aceitar: true })}
            >
              <Check className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              aria-label="Recusar convidado"
              disabled={acao.isPending}
              onClick={() => acao.mutate({ id: s.id, aceitar: false })}
            >
              <X className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
