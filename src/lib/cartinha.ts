/**
 * Cartinhas de Jogador (estilo EA FC / Ultimate Team).
 *
 * Centraliza a lógica de exibição da cartinha: siglas das estatísticas,
 * posição, tema (bronze/prata/ouro + especiais) e cálculo puro do OVR,
 * espelhando as regras do banco (supabase/migrations).
 */

/** Abreviações em português exibidas na cartinha (RIT, FIN, PAS, DRI, DEF, FÍS). */
export const SIGLAS_ATRIBUTO = ["RIT", "FIN", "PAS", "DRI", "DEF", "FÍS"] as const;
export type SiglaAtributo = (typeof SIGLAS_ATRIBUTO)[number];

/** Temas de cartinha: base (bronze/prata/ouro) + especiais (totw/icon/paredao). */
export type TemaCarta = "bronze" | "prata" | "ouro" | "totw" | "icon" | "paredao";

/** Dados de exibição da cartinha de um jogador. */
export interface Cartinha {
  nome: string;
  fotoUrl: string | null;
  posicao: "goleiro" | "linha";
  ovr: number;
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  nivel: number;
  tema: TemaCarta;
}

/** Sigla da posição exibida na cartinha (GOL / ATA / MEI). */
export function posicaoSigla(posicao: "goleiro" | "linha"): string {
  return posicao === "goleiro" ? "GOL" : "ATA";
}

/** Tema base pela faixa de OVR (regra do banco). */
export function temaBasePorOvr(ovr: number): "bronze" | "prata" | "ouro" {
  if (ovr < 65) return "bronze";
  if (ovr <= 74) return "prata";
  return "ouro";
}

export interface ContextoTema {
  /** É o 1º do ranking do mês (TOTW). */
  top1Mes?: boolean;
  /** Nível de XP (icon = Lenda do Baba em níveis altos). */
  nivel?: number;
  /** Total de presenças confirmadas (icon = marcas históricas). */
  presencas?: number;
  /** Goleiro em destaque (paredão). */
  goleiroDestaque?: boolean;
}

/** Tema efetivo da carta: especiais têm prioridade sobre o tema base. */
export function temaEfetivo(base: TemaCarta, ctx: ContextoTema): TemaCarta {
  if (ctx.top1Mes) return "totw";
  if ((ctx.nivel ?? 0) >= 10 || (ctx.presencas ?? 0) >= 100) return "icon";
  if (ctx.goleiroDestaque) return "paredao";
  return base;
}

/** Bônus de nível somado ao OVR base (regra do banco: floor(nivel/3), máx +5). */
export function bonusNivel(nivel: number): number {
  return Math.min(5, Math.floor(nivel / 3));
}

export interface TotaisParaCartinha {
  babasTotal: number;
  presencas: number;
  gols: number;
  assistencias: number;
  penaltisDefendidos: number;
  cartoesAmarelos: number;
  cartoesAzuis: number;
  cartoesVermelhos: number;
  faltas: number;
  golsContra: number;
  vitorias: number;
  nivel: number;
  posicao: "goleiro" | "linha";
  /** Suspensões ativas (baba bloqueado ainda no futuro). Desconto forte na nota. */
  suspensoesAtivas?: number;
}

function clamp(n: number): number {
  return Math.max(1, Math.min(99, Math.round(n)));
}

/**
 * Calcula os 6 atributos (0-99) e o OVR a partir dos totais reais.
 * Espelha `public.calcula_cartinha` do banco — usado para testes e
 * para "preview" sem depender do backfill.
 */
export function calculaAtributos(t: TotaisParaCartinha): {
  pac: number;
  sho: number;
  pas: number;
  dri: number;
  def: number;
  phy: number;
  ovr: number;
} {
  const freq = t.babasTotal > 0 ? Math.min(1, t.presencas / t.babasTotal) : 0;
  const porBaba = (valor: number) => (t.presencas > 0 ? valor / t.presencas : 0);

  const pac = clamp(40 + freq * 59);
  const sho = clamp(40 + porBaba(t.gols) * 15);
  const pas = clamp(40 + porBaba(t.assistencias) * 15);
  const dri = clamp(40 + porBaba(t.vitorias) * 12 + porBaba(t.gols) * 3);
  // Desconto por SUSPENSÕES ATIVAS: cada suspensão derruba bastante a nota
  // (máx -20), espelhando `public.calcula_cartinha` do banco.
  const descontoSuspensao = Math.min(20, (t.suspensoesAtivas ?? 0) * 5);
  const def = clamp(
    40 +
      porBaba(t.vitorias) * 10 -
      t.cartoesAmarelos * 2 -
      t.cartoesAzuis * 3 -
      t.cartoesVermelhos * 6 -
      t.faltas * 1 -
      t.golsContra * 3 -
      descontoSuspensao,
  );
  const phy = clamp(
    40 +
      t.penaltisDefendidos * 8 +
      (t.posicao === "goleiro" ? 15 : 0) +
      Math.min(20, t.nivel * 2) -
      t.faltas * 1 -
      descontoSuspensao,
  );

  const ovrBase = Math.round((pac + sho + pas + dri + def + phy) / 6);
  const ovr = clamp(ovrBase + bonusNivel(t.nivel) - descontoSuspensao);
  return { pac, sho, pas, dri, def, phy, ovr };
}

/** Rótulo em português de cada atributo (para tooltip/legenda). */
export const ROTULOS_ATRIBUTO: Record<SiglaAtributo, string> = {
  RIT: "Ritmo / Presença (frequência de presenças confirmadas)",
  FIN: "Finalização (média de gols por baba)",
  PAS: "Passe (média de assistências por baba)",
  DRI: "Drible / Habilidade (vitórias nos times sorteados + gols)",
  DEF: "Defesa / Disciplina (vitórias − cartões − faltas cometidas − gols contra)",
  FÍS: "Físico / Raça (pênaltis defendidos + goleiro + nível − faltas cometidas)",
};

/** Rótulo do tema da carta em português. */
export const ROTULOS_TEMA: Record<TemaCarta, string> = {
  bronze: "Bronze",
  prata: "Prata",
  ouro: "Ouro",
  totw: "TOTW — Seleção do Mês",
  icon: "Lenda do Baba",
  paredao: "Paredão",
};
