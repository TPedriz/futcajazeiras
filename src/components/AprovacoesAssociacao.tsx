import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { solicitacoesAssociacaoQuery } from "@/lib/babaQueries";
import { decidirSolicitacaoAssociacao } from "@/lib/associacao.functions";
import { Check, X, HandHeart } from "lucide-react";

/** Fila de aprovação da diretoria para convidados que pediram associação. */
export function AprovacoesAssociacao() {
  const qc = useQueryClient();
  const decidir = useServerFn(decidirSolicitacaoAssociacao);
  const { data: solicitacoes } = useQuery(solicitacoesAssociacaoQuery());

  const [recusando, setRecusando] = useState<{ id: string; nome: string } | null>(null);
  const [justificativa, setJustificativa] = useState("");

  const acao = useMutation({
    mutationFn: async (v: { id: string; aprovar: boolean; justificativa?: string }) =>
      await decidir({
        data: { solicitacaoId: v.id, aprovar: v.aprovar, justificativa: v.justificativa ?? "" },
      }),
    onSuccess: (_r, vars) => {
      toast.success(
        vars.aprovar ? "Associação aprovada" : "Solicitação recusada",
        vars.aprovar
          ? { description: "O jogador já pode pagar a mensalidade e virar membro." }
          : { description: "O usuário foi notificado com a justificativa." },
      );
      setRecusando(null);
      setJustificativa("");
      qc.invalidateQueries({ queryKey: ["solicitacoes-associacao"] });
      qc.invalidateQueries({ queryKey: ["papeis-todos"] });
      qc.invalidateQueries({ queryKey: ["solicitacao-associacao"] });
    },
    onError: (e: Error) => toast.error("Erro", { description: e.message }),
  });

  const pendentes = (solicitacoes ?? []).filter((s) => s.status === "pendente");

  return (
    <div className="card-vip p-5">
      <div className="flex items-center gap-2">
        <HandHeart className="size-5 text-gold" />
        <p className="font-display text-lg">Pedidos de associação</p>
        <Badge variant="outline" className="ml-auto border-gold/40 text-gold">
          {pendentes.length}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Ao aprovar, o convidado vira associado e a mensalidade do mês é liberada para pagamento. Ao
        recusar, é obrigatório informar o motivo — ele recebe a justificativa no sininho.
      </p>

      {pendentes.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nenhum pedido aguardando.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {pendentes.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{s.nome}</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  Pedido em {new Date(s.criado_em).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <Button
                variant="success"
                size="icon"
                aria-label={`Aprovar associação de ${s.nome}`}
                disabled={acao.isPending}
                onClick={() => acao.mutate({ id: s.id, aprovar: true })}
              >
                <Check className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={`Recusar associação de ${s.nome}`}
                disabled={acao.isPending}
                onClick={() => {
                  setJustificativa("");
                  setRecusando({ id: s.id, nome: s.nome });
                }}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!recusando} onOpenChange={(o) => !o && setRecusando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar associação</DialogTitle>
            <DialogDescription>
              {recusando?.nome} vai receber essa justificativa na central de notificações.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="justificativa">Justificativa</Label>
            <Textarea
              id="justificativa"
              rows={3}
              placeholder="Ex.: lista de associados cheia no momento."
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
            />
          </div>
          <Button
            variant="hero"
            size="lg"
            disabled={acao.isPending || justificativa.trim().length < 5}
            onClick={() =>
              recusando &&
              acao.mutate({ id: recusando.id, aprovar: false, justificativa: justificativa.trim() })
            }
          >
            Confirmar recusa
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
