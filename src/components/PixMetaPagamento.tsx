import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PagamentoDialog } from "@/components/PagamentoDialog";
import { criarPixMeta, consultarPixMeta } from "@/lib/metas.functions";
import type { DadosCobranca, MetodoPagamento } from "@/lib/taxasPagamento";
import { toast } from "sonner";

/**
 * Etapa 2 do fluxo de arrecadação por item: pagamento por PIX ou cartão.
 *
 * Recebe uma contribuição já cadastrada (pendente), deixa o usuário escolher a
 * forma de pagamento, gera a cobrança e fica em polling até a confirmação. Ao
 * confirmar, o nome do usuário entra na lista de pagos (status "confirmada").
 *
 * Reutilizável: pode ser aberto logo após o cadastro (Etapa 1) ou depois,
 * pelo botão "Pagar agora" no card da meta.
 */
export function PixMetaPagamento({
  aberto,
  contribuicaoId,
  titulo,
  valorBase = 0,
  onAbertoChange,
}: {
  aberto: boolean;
  contribuicaoId: string | null;
  titulo: string;
  /** Valor base da contribuição (sem a taxa da forma de pagamento). */
  valorBase?: number;
  onAbertoChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const gerar = useServerFn(criarPixMeta);
  const conferir = useServerFn(consultarPixMeta);
  const [dados, setDados] = useState<DadosCobranca | null>(null);
  const [pago, setPago] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confirmada = () => {
    setPago(true);
    toast.success("Pagamento confirmado!", {
      description: "Seu cadastro está confirmado. Obrigado!",
    });
    void qc.invalidateQueries({ queryKey: ["metas"] });
    void qc.invalidateQueries({ queryKey: ["contribuicoes-meta"] });
    void qc.invalidateQueries({ queryKey: ["minhas-contribuicoes"] });
    void qc.invalidateQueries({ queryKey: ["feed-global"] });
  };

  // Recomeça do zero sempre que o diálogo abre para outra contribuição.
  useEffect(() => {
    if (!aberto) return;
    setDados(null);
    setPago(false);
    setErro(null);
  }, [aberto, contribuicaoId]);

  const gerarCobranca = useMutation({
    mutationFn: async (metodo: MetodoPagamento) => {
      if (!contribuicaoId) throw new Error("Contribuição não encontrada");
      setDados(null);
      setPago(false);
      setErro(null);
      return await gerar({ data: { contribuicaoId, metodo } });
    },
    onSuccess: (r) => {
      if (r.pago) {
        confirmada();
        return;
      }
      setDados(r);
    },
    onError: (e: Error) => {
      setErro(e.message);
      toast.error("Não foi possível gerar a cobrança", { description: e.message });
    },
  });

  // Polling enquanto há cobrança e o pagamento não foi confirmado.
  useEffect(() => {
    if (!aberto || !contribuicaoId || pago || !dados) return;
    const id = setInterval(async () => {
      try {
        const r = await conferir({ data: { contribuicaoId } });
        if (r.pago) {
          clearInterval(id);
          confirmada();
        }
      } catch {
        /* ignora — o polling continua */
      }
    }, 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, contribuicaoId, pago, dados, qc]);

  return (
    <PagamentoDialog
      open={aberto}
      onOpenChange={onAbertoChange}
      titulo={`Pagamento — ${titulo}`}
      descricao="Escaneie o QR Code ou copie o código PIX para pagar."
      valorBase={valorBase}
      dados={dados}
      carregando={gerarCobranca.isPending}
      pago={pago}
      erro={erro}
      onEscolherMetodo={(metodo) => gerarCobranca.mutate(metodo)}
    />
  );
}
