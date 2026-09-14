// Integração com a API do Mercado Pago (PIX e cartão). Somente servidor.
import {
  CHAVES_TAXA,
  TAXAS_PADRAO,
  calcularCobranca,
  type CobrancaCalculada,
  type MetodoPagamento,
} from "@/lib/taxasPagamento";

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
  return process.env.APP_PUBLIC_URL || "https://www.futcajazeiras.com.br";
}

export function urlWebhook() {
  return `${urlBase()}/api/public/mercadopago-webhook`;
}

/* ========================== Taxas do pagador ========================== */

/**
 * Taxas por forma de pagamento lidas de `configuracoes` (ajustáveis pela
 * diretoria em Admin › Financeiro).
 */
export async function taxasPagamento(): Promise<Record<MetodoPagamento, number>> {
  const taxas: Record<MetodoPagamento, number> = { ...TAXAS_PADRAO };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("configuracoes")
      .select("chave, valor")
      .in("chave", Object.values(CHAVES_TAXA));
    const metodos = Object.keys(CHAVES_TAXA) as MetodoPagamento[];
    for (const linha of data ?? []) {
      const metodo = metodos.find((m) => CHAVES_TAXA[m] === linha.chave);
      if (!metodo) continue;
      const percentual = Number(linha.valor);
      if (Number.isFinite(percentual) && percentual >= 0) taxas[metodo] = percentual;
    }
  } catch (e) {
    console.error("[MercadoPago] não foi possível ler as taxas; usando o padrão", e);
  }
  return taxas;
}

/**
 * Valor a cobrar do pagador: base + taxa do método, com a taxa arredondada
 * para cima até o centavo.
 */
export async function cobrancaComTaxa(
  valorBase: number,
  metodo: MetodoPagamento,
): Promise<CobrancaCalculada> {
  const taxas = await taxasPagamento();
  return calcularCobranca(valorBase, taxas[metodo] ?? 0);
}

export interface PixCriado {
  paymentId: string;
  status: string;
  qrCode: string | null;
  qrBase64: string | null;
  expiraEm: string | null;
  /** Tipo informado pelo Mercado Pago (credit_card, debit_card, bank_transfer...). */
  paymentTypeId?: string | null;
  /** Meio específico (pix, visa, master...). */
  paymentMethodId?: string | null;
}

interface MpPayment {
  id: number | string;
  status: string;
  external_reference?: string | null;
  date_of_expiration?: string | null;
  payment_type_id?: string | null;
  payment_method_id?: string | null;
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
    paymentTypeId: p.payment_type_id ?? null,
    paymentMethodId: p.payment_method_id ?? null,
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

/* ====================== Cartão de crédito / débito ====================== */

/**
 * Checkout Pro (redirecionamento): cria uma preferência restrita ao tipo de
 * cartão escolhido. O Mercado Pago cuida do formulário, 3DS, CPF e parcelas —
 * nenhum dado de cartão passa pela aplicação.
 */
export interface PreferenciaCartao {
  preferenceId: string;
  initPoint: string;
  sandboxInitPoint: string | null;
}

interface MpPreference {
  id: string;
  init_point?: string;
  sandbox_init_point?: string;
}

/** Tipos de pagamento bloqueados para garantir só cartão de crédito ou débito. */
const TIPOS_EXCLUIDOS: Record<"credito" | "debito", string[]> = {
  credito: ["debit_card", "ticket", "bank_transfer", "atm", "prepaid_card"],
  debito: ["credit_card", "ticket", "bank_transfer", "atm", "prepaid_card"],
};

export async function criarPreferenciaCartao(opts: {
  metodo: "credito" | "debito";
  valor: number;
  descricao: string;
  email: string;
  externalReference: string;
  /** Caminho interno para onde o Mercado Pago devolve o usuário. */
  retorno: string;
  idempotencyKey: string;
}): Promise<PreferenciaCartao> {
  const caminho = opts.retorno.startsWith("/") ? opts.retorno : "/pagamentos";
  const separador = caminho.includes("?") ? "&" : "?";
  const voltar = `${urlBase()}${caminho}${separador}mp_ref=${encodeURIComponent(
    opts.externalReference,
  )}`;

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": opts.idempotencyKey,
    },
    body: JSON.stringify({
      items: [
        {
          id: opts.externalReference.slice(0, 64),
          title: opts.descricao.slice(0, 250),
          description: opts.descricao.slice(0, 250),
          category_id: "others",
          quantity: 1,
          currency_id: "BRL",
          unit_price: Number(opts.valor),
        },
      ],
      payer: { email: opts.email },
      external_reference: opts.externalReference,
      notification_url: urlWebhook(),
      back_urls: {
        success: `${voltar}&mp_status=approved`,
        pending: `${voltar}&mp_status=pending`,
        failure: `${voltar}&mp_status=failure`,
      },
      auto_return: "approved",
      payment_methods: {
        excluded_payment_types: TIPOS_EXCLUIDOS[opts.metodo].map((id) => ({ id })),
        installments: opts.metodo === "credito" ? 3 : 1,
        default_installments: 1,
      },
    }),
  });

  const texto = await res.text();
  if (!res.ok) {
    console.error(`[MercadoPago] /checkout/preferences falhou [${res.status}]: ${texto}`);
    throw new Error(`Mercado Pago recusou a cobrança no cartão [${res.status}]: ${texto}`);
  }
  const preferencia = JSON.parse(texto) as MpPreference;
  return {
    preferenceId: preferencia.id,
    initPoint: preferencia.init_point ?? "",
    sandboxInitPoint: preferencia.sandbox_init_point ?? null,
  };
}

/** Em sandbox o `init_point` não funciona — nesse caso usamos o de teste. */
export function urlCheckout(p: PreferenciaCartao): string {
  if (token().startsWith("TEST-")) return p.sandboxInitPoint || p.initPoint;
  return p.initPoint || p.sandboxInitPoint || "";
}

/**
 * Busca o pagamento mais relevante de uma referência externa, seja PIX ou
 * cartão. Prefere um pagamento aprovado; sem ele, um pendente.
 */
export async function consultarPagamentoPorReferencia(externalReference: string) {
  const url =
    `${MP_API}/v1/payments/search?sort=date&criteria=desc` +
    `&external_reference=${encodeURIComponent(externalReference)}`;

  let corpo: { results?: MpPayment[] };
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token()}` } });
    const texto = await res.text();
    if (!res.ok) {
      console.error(`[MercadoPago] busca por referência falhou [${res.status}]: ${texto}`);
      return null;
    }
    corpo = JSON.parse(texto) as { results?: MpPayment[] };
  } catch (e) {
    console.error("[MercadoPago] busca por referência", e);
    return null;
  }

  const resultados = corpo.results ?? [];
  if (resultados.length === 0) return null;
  const escolhido =
    resultados.find((p) => p.status === "approved") ??
    resultados.find((p) => ["pending", "in_process", "authorized"].includes(p.status)) ??
    resultados[0];
  return { ...mapear(escolhido), externalReference: escolhido.external_reference ?? null };
}
