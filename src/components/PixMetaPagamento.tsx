import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PixDialog, type DadosPix } from "@/components/PixDialog";
import { criarPixMeta, consultarPixMeta } from "@/lib/metas.functions";
import { toast } from "sonner";

/**
 * Etapa 2 do fluxo de arrecadação por item: pagamento via PIX.
 *
 * Recebe uma contribuição já cadastrada (pendente), gera a cobrança PIX e
 * fica em polling até a confirmação. Ao confirmar, o nome do usuário entra na
 * lista de pagos (status "confirmada").
 *
 * Reutilizável: pode ser aberto logo após o cadastro (Etapa 1) ou depois,
 * pelo botão "Pagar agora" no card da meta.
 */
export function PixMetaPagamento({
  aberto,
  contribuicaoId,
  titulo,
  onAbertoChange,
}: {
  aberto: boolean;
  contribuicaoId: string | null;
  titulo: string;
  onAbertoChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [pix, setPix] = useState<DadosPix | null>(null);
  const [pago, setPago] = useState(false);

  // Gera a cobrança PIX ao abrir com uma contribuição pendente.
  useEffect(() => {
    if (!aberto || !contribuicaoId) return;
    let cancelado = false;
    setPix(null);
    setPago(false);
    criarPixMeta({ data: { contribuicaoId } })
      .then((r) => {
        if (cancelado) return;
        setPix({ qrCode: r.qrCode, qrBase64: r.qrBase64, valor: r.valor });
      })
      .catch((e) => {
        if (cancelado) return;
        toast.error("Não foi possível gerar o PIX", {
          description: e instanceof Error ? e.message : "Tente novamente.",
        });
      });
    return () => {
      cancelado = true;
    };
  }, [aberto, contribuicaoId]);

  // Polling enquanto o PIX está aberto.
  useEffect(() => {
    if (!aberto || !contribuicaoId || pago) return;
    const id = setInterval(async () => {
      try {
        const r = await consultarPixMeta({ data: { contribuicaoId } });
        if (r.pago) {
          setPago(true);
          clearInterval(id);
          toast.success("Pagamento confirmado!", {
            description: "Seu cadastro está confirmado. Obrigado!",
          });
          void qc.invalidateQueries({ queryKey: ["metas"] });
          void qc.invalidateQueries({ queryKey: ["contribuicoes-meta"] });
          void qc.invalidateQueries({ queryKey: ["minhas-contribuicoes"] });
          void qc.invalidateQueries({ queryKey: ["feed-global"] });
        }
      } catch {
        /* ignora — o polling continua */
      }
    }, 5000);
    return () => clearInterval(id);
  }, [aberto, contribuicaoId, pago, qc]);

  return (
    <PixDialog
      open={aberto}
      onOpenChange={onAbertoChange}
      titulo={`Pagamento — ${titulo}`}
      descricao="Escaneie o QR Code ou copie o código PIX para pagar."
      dados={pix}
      carregando={!pix}
      pago={pago}
    />
  );
}
