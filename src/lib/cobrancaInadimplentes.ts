/**
 * Cobrança de inadimplentes — monta o texto (para o WhatsApp) com a legenda da
 * regra de cobrança + a lista com nome e valor devido de cada inadimplente.
 *
 * Regra cobrada (espelha `aplica_multas_usuario` / `pendencias_financeiras`):
 *   cada mensalidade em aberto entra pelo valor cheio + a multa de atraso
 *   vigente por mês atrasado + a Taxa de Associação (reinscrição), cobrada uma
 *   única vez na retomada do vínculo. A partir de 1 mês de atraso a associação
 *   fica com o status `INADIMPLENTE` (direitos suspensos) até a quitação.
 */
import { formatarReais } from "./redeSocial.ts";

/** Uma mensalidade em aberto usada no cálculo da cobrança. */
export interface MensalidadeCobranca {
  /** Mês de referência (ISO, ex.: "2026-07-01"). */
  referencia: string;
  valor: number;
  multa: number;
}

export interface InadimplenteCobranca {
  nome: string;
  mensalidades: MensalidadeCobranca[];
}

export interface OpcoesCobranca {
  /** Valor vigente da mensalidade (para a legenda). */
  valorMensalidade?: number;
  /** Valor vigente da multa por mês de atraso (para a legenda). */
  valorMulta?: number;
  /** Taxa de Associação (reinscrição) cobrada uma vez na retomada do vínculo. */
  valorTaxaAssociacao?: number;
  /** Data base exibida no cabeçalho (padrão: agora). */
  data?: Date;
  /** Assinatura no rodapé (padrão: site do clube). */
  url?: string;
}

export interface ResumoCobranca {
  /** Quantidade de mensalidades em aberto. */
  meses: number;
  /** Quantidade de mensalidades que já receberam multa. */
  multas: number;
  totalMensalidades: number;
  totalMultas: number;
  /** Taxa de Associação (reinscrição) aplicada a este inadimplente. */
  taxaAssociacao: number;
  /** Mensalidades + multas + taxa de associação. */
  total: number;
  /** Meses no formato "07/2026, 08/2026". */
  mesesTexto: string;
}

function numero(valor: unknown): number {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Valor em reais para texto de WhatsApp: troca o espaço não separável (U+00A0)
 * que o `toLocaleString` insere por um espaço comum (evita quebras estranhas
 * ao colar em apps de mensagem).
 */
function reais(valor: number | string | null | undefined): string {
  return formatarReais(valor).replace(/\u00a0/g, " ");
}

function dataCurta(data: Date): string {
  return `${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}/${data.getFullYear()}`;
}

/** Rótulo curto do mês de referência: "2026-07-01" -> "07/2026". */
export function mesReferenciaCurto(referencia: string | null | undefined): string {
  const texto = String(referencia ?? "");
  const partes = /^(\d{4})-(\d{2})/.exec(texto);
  return partes ? `${partes[2]}/${partes[1]}` : texto;
}

/** Soma mensalidades, multas, taxa de associação e total de um inadimplente. */
export function resumoCobranca(item: InadimplenteCobranca, taxaAssociacao = 0): ResumoCobranca {
  const mensalidades = item?.mensalidades ?? [];
  const totalMensalidades = mensalidades.reduce((soma, m) => soma + numero(m.valor), 0);
  const totalMultas = mensalidades.reduce((soma, m) => soma + numero(m.multa), 0);
  const taxa = numero(taxaAssociacao);
  return {
    meses: mensalidades.length,
    multas: mensalidades.filter((m) => numero(m.multa) > 0).length,
    totalMensalidades,
    totalMultas,
    taxaAssociacao: taxa,
    total: totalMensalidades + totalMultas + taxa,
    mesesTexto: mensalidades.map((m) => mesReferenciaCurto(m.referencia)).join(", "),
  };
}

/** Total a receber da lista completa (inclui a taxa de associação de cada um). */
export function totalCobranca(lista: InadimplenteCobranca[], taxaAssociacao = 0): number {
  return (lista ?? []).reduce((soma, item) => soma + resumoCobranca(item, taxaAssociacao).total, 0);
}

/** Linha de detalhe (meses, multas e taxa de associação) de um inadimplente. */
function linhaDetalhe(resumo: ResumoCobranca): string {
  const partes: string[] = [];
  if (resumo.meses > 0) {
    const rotulo = resumo.meses === 1 ? "Mensalidade" : "Mensalidades";
    partes.push(`${rotulo}: ${resumo.mesesTexto} (${reais(resumo.totalMensalidades)})`);
  }
  if (resumo.totalMultas > 0) {
    const qtd = `${resumo.multas} ${resumo.multas === 1 ? "multa" : "multas"} de atraso`;
    partes.push(`${qtd} (${reais(resumo.totalMultas)})`);
  }
  if (resumo.taxaAssociacao > 0) {
    partes.push(`Taxa de Associação (${reais(resumo.taxaAssociacao)})`);
  }
  return partes.join(" + ");
}

/**
 * Monta o texto da cobrança dos inadimplentes para colar/enviar no WhatsApp:
 * legenda da regra (mensalidades + multa por mês de atraso + taxa de
 * associação) e a lista nominal com o valor devido por pessoa.
 */
export function formatarCobrancaInadimplentesParaWhatsApp(
  lista: InadimplenteCobranca[],
  opcoes: OpcoesCobranca = {},
): string {
  const dataBase = opcoes.data ?? new Date();
  const valorMensalidade = numero(opcoes.valorMensalidade);
  const valorMulta = numero(opcoes.valorMulta);
  const valorTaxa = numero(opcoes.valorTaxaAssociacao);
  const url = opcoes.url ?? "www.futcajazeiras.com.br";

  // Ordena do maior débito para o menor — facilita a priorização da cobrança.
  const itens = (lista ?? [])
    .map((item) => ({ item, resumo: resumoCobranca(item, valorTaxa) }))
    .sort((a, b) => b.resumo.total - a.resumo.total);

  const total = itens.reduce((soma, { resumo }) => soma + resumo.total, 0);

  const linhas: string[] = [];
  linhas.push("🚨 MENSALIDADES EM ATRASO — FUT CAJAZEIRAS");
  linhas.push(`Atualizado em ${dataCurta(dataBase)}`);
  linhas.push("");

  if (itens.length === 0) {
    linhas.push("✅ Nenhum inadimplente no momento — todo mundo em dia!");
    linhas.push("");
    linhas.push(url);
    return linhas.join("\n");
  }

  linhas.push("📌 COMO FUNCIONA A COBRANÇA");
  if (valorMensalidade > 0 && valorMulta > 0) {
    linhas.push(
      `• Cada mês em atraso: ${reais(valorMensalidade)} de mensalidade + ${reais(valorMulta)} de multa.`,
    );
    linhas.push("• A multa é cobrada por mês de atraso: 2 meses atrasados = 2 multas.");
  } else {
    linhas.push("• Cada mês em atraso é cobrado pelo valor da mensalidade + multa de atraso.");
    linhas.push("• A multa é cobrada por mês de atraso: 2 meses atrasados = 2 multas.");
  }
  if (valorTaxa > 0) {
    linhas.push(
      `• Taxa de Associação (reinscrição): ${reais(valorTaxa)} — cobrada uma única vez, ao retomar o vínculo.`,
    );
  }
  if (valorMensalidade > 0 && valorMulta > 0) {
    const exemplo = valorMensalidade * 2 + valorMulta * 2 + (valorTaxa > 0 ? valorTaxa : 0);
    const partesExemplo = [
      `${reais(valorMensalidade * 2)} de mensalidades`,
      `${reais(valorMulta * 2)} de multas`,
    ];
    if (valorTaxa > 0) partesExemplo.push(`${reais(valorTaxa)} de taxa de associação`);
    linhas.push(`• Exemplo com 2 meses atrasados: ${partesExemplo.join(" + ")} = ${reais(exemplo)}.`);
  }
  linhas.push("• A partir de 1 mês de atraso a associação fica suspensa até a quitação.");
  linhas.push("");

  linhas.push(`⚠️ INADIMPLENTES (${itens.length}) • TOTAL ${reais(total)}`);
  linhas.push("");
  itens.forEach(({ item, resumo }, i) => {
    linhas.push(`${i + 1}. ${item.nome} — ${reais(resumo.total)}`);
    if (resumo.meses > 0 || resumo.taxaAssociacao > 0) linhas.push(`   ${linhaDetalhe(resumo)}`);
  });

  linhas.push("");
  linhas.push("Qualquer dúvida, fale com a diretoria.");
  linhas.push(url);
  return linhas.join("\n");
}
