/**
 * Rede Social + Agenda + Metas — helpers de domínio compartilhados.
 *
 * Normalização de @Instagram, formatação de valores em R$ e cálculo de
 * progresso das metas coletivas. Mantém as regras consistentes em toda a UI.
 */

// ============================================================================
// Arrecadação por item (coletes personalizados etc.)
// ============================================================================

export type TipoArrecadacao = "aberta" | "item";

export const ROTULOS_TIPO_ARRECADACAO: Record<TipoArrecadacao, string> = {
  aberta: "Arrecadação aberta",
  item: "Arrecadação por item",
};

export function rotuloTipoArrecadacao(tipo: string | null | undefined): string {
  return ROTULOS_TIPO_ARRECADACAO[(tipo ?? "aberta") as TipoArrecadacao] ?? "Arrecadação aberta";
}

/** Tamanhos de camisa disponíveis (padrão brasileiro de uniformes). */
export const TAMANHOS_CAMISA = ["P", "M", "G", "GG", "XG", "XXG"] as const;

/**
 * Tamanho único aplicado aos itens genéricos (ex.: colete comum).
 * Itens genéricos não têm personalização — todos usam este tamanho.
 */
export const TAMANHO_ITEM_PADRAO = "Único";

/**
 * Quantos itens (ex.: coletes) a meta comporta: valor alvo ÷ valor individual.
 * Retorna 0 quando não há valor individual definido.
 */
export function itensAteMeta(
  valorAlvo: number | null | undefined,
  valorItem: number | null | undefined,
): number {
  const alvo = Number(valorAlvo ?? 0);
  const item = Number(valorItem ?? 0);
  if (!Number.isFinite(alvo) || !Number.isFinite(item) || item <= 0 || alvo <= 0) return 0;
  return Math.floor(alvo / item);
}

/** Itens que ainda faltam para bater a meta (considera o já arrecadado). */
export function itensRestantes(
  valorAlvo: number | null | undefined,
  valorItem: number | null | undefined,
  valorArrecadado: number | null | undefined,
): number {
  const alvo = Number(valorAlvo ?? 0);
  const arrecadado = Number(valorArrecadado ?? 0);
  const restante = Math.max(0, alvo - arrecadado);
  return itensAteMeta(restante, valorItem);
}

/** Nome padrão exibido para itens genéricos sem personalização. */
export const ROTULO_ITEM_GENERICO = "Item genérico (sem personalização)";

export interface ItemArrecadacaoWhatsApp {
  id: string;
  nome: string;
  nome_camisa: string | null;
  tamanho: string | null;
  numero_camisa: string | null;
  status: string;
}

export interface MetaItemWhatsApp {
  titulo: string;
  categoria: string;
  valor_item: number | null;
  valor_alvo: number | null;
  valor_arrecadado: number;
  prazo_cadastro: string | null;
  prazo_pagamento: string | null;
  exige_personalizacao?: boolean;
}

/** Uma linha da lista de participantes (pagos ou pendentes) para o WhatsApp. */
function linhaParticipante(c: ItemArrecadacaoWhatsApp, i: number): string {
  const partes: string[] = [];
  if (c.nome_camisa) partes.push(`"${c.nome_camisa}"`);
  if (c.numero_camisa) partes.push(`#${c.numero_camisa}`);
  if (c.tamanho) partes.push(`(${c.tamanho})`);
  const detalhe = partes.length > 0 ? ` — ${partes.join(" ")}` : "";
  return `${i + 1}. ${c.nome}${detalhe}`;
}

/** Data dd/MM/yyyy ou "" se ausente. */
function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(`${iso}T12:00:00`);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  } catch {
    return "";
  }
}

/**
 * Monta o texto da arrecadação por item para colar no WhatsApp da diretoria
 * (mesmo mecanismo do sorteio: clipboard + "Cole no grupo").
 */
export function formatarArrecadacaoItemParaWhatsApp(
  meta: MetaItemWhatsApp,
  contribuicoes: ItemArrecadacaoWhatsApp[],
): string {
  const linhas: string[] = [];
  linhas.push(`🦺 ${meta.titulo.toUpperCase()}`);
  linhas.push("");

  linhas.push(`Valor por item: ${formatarReais(meta.valor_item)}`);
  if (meta.valor_alvo != null && meta.valor_alvo > 0) {
    linhas.push(`Meta total: ${formatarReais(meta.valor_alvo)}`);
    const capacidade = itensAteMeta(meta.valor_alvo, meta.valor_item);
    if (capacidade > 0) linhas.push(`Itens até bater a meta: ${capacidade}`);
  }
  linhas.push(`Arrecadado: ${formatarReais(meta.valor_arrecadado)}`);
  if (meta.prazo_cadastro) linhas.push(`Prazo de cadastro: ${dataCurta(meta.prazo_cadastro)}`);
  if (meta.prazo_pagamento) linhas.push(`Prazo de pagamento: ${dataCurta(meta.prazo_pagamento)}`);

  const pagos = contribuicoes.filter((c) => c.status === "confirmada");
  const pendentes = contribuicoes.filter((c) => c.status === "pendente");

  linhas.push("");
  linhas.push(`✅ PAGOS (${pagos.length})`);
  pagos.forEach((c, i) => linhas.push(linhaParticipante(c, i)));

  linhas.push("");
  linhas.push(`⏳ PENDENTES DE PAGAMENTO (${pendentes.length})`);
  pendentes.forEach((c, i) => linhas.push(linhaParticipante(c, i)));

  if (pagos.length === 0 && pendentes.length === 0) {
    linhas.push("");
    linhas.push("Nenhum cadastro ainda.");
  }

  linhas.push("");
  linhas.push("www.futcajazeiras.com.br");
  return linhas.join("\n");
}

// ============================================================================
// Instagram
// ============================================================================

/** Remove @, espaços e caracteres inválidos. Aceita vazio (não obrigatório). */
export function normalizaInstagram(valor: string): string {
  return valor
    .trim()
    .replace(/^@+/, "")
    .replace(/\s+/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_.]/g, "");
}

/** Formata para exibição com o @ na frente (retorna null se vazio). */
export function instagramFormatado(valor: string | null | undefined): string | null {
  const normalizado = normalizaInstagram(valor ?? "");
  return normalizado ? `@${normalizado}` : null;
}

/** Link do perfil do Instagram (null se não houver). */
export function instagramUrl(valor: string | null | undefined): string | null {
  const normalizado = normalizaInstagram(valor ?? "");
  return normalizado ? `https://instagram.com/${normalizado}` : null;
}

// ============================================================================
// Moeda (R$)
// ============================================================================

/** Formata um valor em reais (ex.: R$ 1.500,00). */
export function formatarReais(valor: number | string | null | undefined): string {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero)) return "R$ 0,00";
  return numero.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// ============================================================================
// Metas coletivas
// ============================================================================

export type StatusMeta = "ativa" | "encerrada" | "atingida";

export const ROTULOS_STATUS_META: Record<StatusMeta, string> = {
  ativa: "Ativa",
  encerrada: "Encerrada",
  atingida: "Meta atingida!",
};

export const ROTULOS_CATEGORIA_META: Record<string, string> = {
  material_esportivo: "Material esportivo",
  eventos: "Eventos",
  resenha: "Resenha",
  infraestrutura: "Infraestrutura",
  uniforme: "Uniforme",
  outros: "Outros",
};

export function rotuloCategoriaMeta(categoria: string | null | undefined): string {
  return ROTULOS_CATEGORIA_META[categoria ?? ""] ?? "Outros";
}

export function rotuloStatusMeta(status: string | null | undefined): string {
  return ROTULOS_STATUS_META[(status ?? "ativa") as StatusMeta] ?? status ?? "Ativa";
}

export interface ProgressoMeta {
  arrecadado: number;
  alvo: number;
  restante: number;
  percentual: number;
}

/** Progresso de uma meta (arrecadado / alvo), com percentual capado em 100%. */
export function progressoMeta(
  arrecadado: number | null | undefined,
  alvo: number | null | undefined,
): ProgressoMeta {
  const valor = Number(arrecadado ?? 0);
  const alvoNumero = Number(alvo ?? 0);
  const restante = Math.max(0, alvoNumero - valor);
  const percentual = alvoNumero > 0 ? Math.min(100, Math.round((valor / alvoNumero) * 100)) : 0;
  return { arrecadado: valor, alvo: alvoNumero, restante, percentual };
}

// ============================================================================
// Agenda da Arena
// ============================================================================

export type StatusEventoAgenda = "agendado" | "cancelado" | "concluido";

export const ROTULOS_STATUS_EVENTO: Record<StatusEventoAgenda, string> = {
  agendado: "Agendado",
  cancelado: "Cancelado",
  concluido: "Concluído",
};

export const ROTULOS_CATEGORIA_EVENTO: Record<string, string> = {
  baba: "Baba",
  evento: "Evento",
  outro: "Outro",
};

export function rotuloCategoriaEvento(categoria: string | null | undefined): string {
  return ROTULOS_CATEGORIA_EVENTO[categoria ?? ""] ?? "Evento";
}

export function rotuloStatusEvento(status: string | null | undefined): string {
  return (
    ROTULOS_STATUS_EVENTO[(status ?? "agendado") as StatusEventoAgenda] ?? status ?? "Agendado"
  );
}

/** Formata hora "20:00:00" -> "20:00". */
export function formatarHora(hora: string | null | undefined): string {
  if (!hora) return "";
  return hora.slice(0, 5);
}

/** Nome curto do dia da semana (pt-BR). */
const DIAS_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DIAS_SEMANA_CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function diaDaSemana(data: string | Date): string {
  return DIAS_SEMANA[new Date(data).getDay()];
}

export function diaDaSemanaCurto(data: string | Date): string {
  return DIAS_SEMANA_CURTO[new Date(data).getDay()];
}
