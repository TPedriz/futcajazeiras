import { createFileRoute } from "@tanstack/react-router";

// Webhook do Mercado Pago. O corpo recebido nunca é confiado:
// usamos apenas o id do pagamento e confirmamos o status direto na API
// do Mercado Pago com o access token da conta.
export const Route = createFileRoute("/api/public/mercadopago-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          let paymentId = url.searchParams.get("data.id") ?? url.searchParams.get("id");

          const bruto = await request.text();
          if (bruto) {
            try {
              const corpo = JSON.parse(bruto) as {
                type?: string;
                topic?: string;
                data?: { id?: string | number };
              };
              const tipo = corpo.type ?? corpo.topic;
              if (tipo && tipo !== "payment") return new Response("ignorado", { status: 200 });
              if (corpo.data?.id) paymentId = String(corpo.data.id);
            } catch {
              // corpo não-JSON: seguimos com o id da query string
            }
          }

          if (!paymentId || !/^\d+$/.test(paymentId)) {
            return new Response("id ausente", { status: 200 });
          }

          const { consultarPagamentoMp } = await import("@/lib/mercadopago.server");
          const pagamento = await consultarPagamentoMp(paymentId);
          if (!pagamento.externalReference) return new Response("sem referência", { status: 200 });

          const { aplicarPagamento } = await import("@/lib/pagamentos.server");
          await aplicarPagamento(pagamento.externalReference, pagamento.status);

          return new Response("ok", { status: 200 });
        } catch (e) {
          console.error("[MercadoPago webhook]", e);
          return new Response("erro", { status: 500 });
        }
      },
    },
  },
});
