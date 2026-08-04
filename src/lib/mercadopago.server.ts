// Integração com a API do Mercado Pago (PIX). Somente servidor.
const MP_API = "https://api.mercadopago.com";

export const VALOR_MENSALIDADE = 15;
export const VALOR_CONVIDADO = 5;

/** Valor atual da diária de convidado definido pela diretoria (configuracoes). */
export async function valorConvidadoAtual(): Promise<number> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("configuracoes")
    .select("valor")
    .eq("chave", "valor_convidado")
    .maybeSingle();
  return Number(data?.valor ?? VALOR_CONVIDADO);
}

function token() {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!t) throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado");
  return t;
}

export function urlBase() {
  return process.env.APP_PUBLIC_URL || "https://futcajazeiras.lovable.app";
}

export function urlWebhook() {
  return `${urlBase()}/api/public/mercadopago-webhook`;
}

export interface PixCriado {
  paymentId: string;
  status: string;
  qrCode: string | null;
  qrBase64: string | null;
  expiraEm: string | null;
}

interface MpPayment {
  id: number | string;
  status: string;
  external_reference?: string | null;
  date_of_expiration?: string | null;
  point_of_interaction?: {
    transaction_data?: { qr_code?: string; qr_code_base64?: string };
  };
}

function mapear(p: MpPayment): PixCriado {
  const td = p.point_of_interaction?.transaction_data;
  return {
    paymentId: String(p.id),
    status: p.status,
    qrCode: td?.qr_code ?? null,
    qrBase64: td?.qr_code_base64 ?? null,
    expiraEm: p.date_of_expiration ?? null,
  };
}

async function mpFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${MP_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const texto = await res.text();
  if (!res.ok) {
    console.error(`[MercadoPago] ${path} falhou [${res.status}]: ${texto}`);
    throw new Error(`Mercado Pago recusou a operação [${res.status}]: ${texto}`);
  }
  return JSON.parse(texto) as MpPayment;
}

export async function criarPagamentoPix(opts: {
  valor: number;
  descricao: string;
  email: string;
  nome: string;
  externalReference: string;
  idempotencyKey: string;
}): Promise<PixCriado> {
  const expira = new Date(Date.now() + 30 * 60 * 1000);
  const pagamento = await mpFetch("/v1/payments", {
    method: "POST",
    headers: { "X-Idempotency-Key": opts.idempotencyKey },
    body: JSON.stringify({
      transaction_amount: Number(opts.valor),
      description: opts.descricao,
      payment_method_id: "pix",
      external_reference: opts.externalReference,
      notification_url: urlWebhook(),
      date_of_expiration: expira.toISOString().replace("Z", "-00:00"),
      payer: {
        email: opts.email,
        first_name: opts.nome.split(" ")[0] || "Associado",
        last_name: opts.nome.split(" ").slice(1).join(" ") || "Fut Cajazeiras",
      },
    }),
  });
  return mapear(pagamento);
}

export async function consultarPagamentoMp(paymentId: string) {
  const pagamento = await mpFetch(`/v1/payments/${paymentId}`);
  return { ...mapear(pagamento), externalReference: pagamento.external_reference ?? null };
}

export function emailPagador(telefone: string | null | undefined, userId: string) {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  const local = digitos || userId.replace(/-/g, "").slice(0, 16);
  return `pagador.${local}@futcajazeiras.com.br`;
}
