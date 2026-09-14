import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { confirmarPagamentoRetorno } from "@/lib/pagamentos.functions";

/** Parâmetros que o Mercado Pago devolve na URL de retorno. */
const PARAMS_MP = [
  "mp_ref",
  "mp_status",
  "payment_id",
  "status",
  "external_reference",
  "collection_id",
  "collection_status",
  "payment_type",
  "merchant_order_id",
  "preference_id",
  "site_id",
  "processing_mode",
  "merchant_account_id",
];

const KEYS_INVALIDAR = [
  ["mensalidades-minhas"],
  ["mensalidades-mes"],
  ["situacao-financeira"],
  ["perfil-atual"],
  ["presencas"],
  ["metas"],
  ["contribuicoes-meta"],
  ["minhas-contribuicoes"],
  ["mensalidades-pendentes-presente"],
];

/**
 * Fecha o ciclo do checkout do cartão: quando o Mercado Pago devolve o usuário
 * para o app (`?mp_ref=...&mp_status=...`), reconsultamos o pagamento na API e
 * aplicamos o resultado no banco. Nada da URL é confiado.
 *
 * Fica no layout autenticado, então vale para qualquer página de pagamento.
 */
export function RetornoPagamento() {
  const confirmar = useServerFn(confirmarPagamentoRetorno);
  const qc = useQueryClient();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const referencia = params.get("mp_ref") ?? params.get("external_reference");
    if (!referencia) return;
    const status = params.get("mp_status") ?? params.get("status") ?? "";

    // Limpa a URL para não repetir o aviso em recarregamentos.
    const url = new URL(window.location.href);
    let sujo = false;
    for (const chave of PARAMS_MP) {
      if (url.searchParams.has(chave)) {
        url.searchParams.delete(chave);
        sujo = true;
      }
    }
    if (sujo) window.history.replaceState({}, "", url.toString());

    void (async () => {
      try {
        const r = await confirmar({ data: { externalReference: referencia } });
        if (r.pago) {
          toast.success("Pagamento confirmado!", {
            description: "Já atualizamos tudo por aqui.",
          });
          for (const key of KEYS_INVALIDAR) void qc.invalidateQueries({ queryKey: key });
          return;
        }
        if (status === "failure") {
          toast.error("O pagamento não foi concluído", {
            description: "Você pode tentar novamente quando quiser.",
          });
          return;
        }
        toast.info("Aguardando a confirmação do Mercado Pago", {
          description: "Assim que o pagamento cair, o status atualiza sozinho.",
        });
      } catch {
        /* silencioso: o webhook ainda confirma o pagamento */
      }
    })();
  }, [confirmar, qc]);

  return null;
}
