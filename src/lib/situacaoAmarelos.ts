/**
 * Janela de cartões amarelos — regra do Fut Cajazeiras.
 *
 * Dentro de uma "janela" de N babas recentes, o jogador pode tomar até
 * (limite - 1) cartões amarelos sem consequência. Ao atingir o limite, fica
 * suspenso do próximo baba. Quando está a 1 de atingir (ex.: 2 cartões com
 * limite 3), mostramos um aviso: ele não pode tomar outro cartão amarelo até
 * o cartão mais antigo sair da janela.
 *
 * Espelha `public.aplica_suspensao_amarelos` (banco) e a política
 * `janela_amarelos` / `limite_amarelos` / `suspensao_amarelos_babas`.
 */

export interface BabaComData {
  id: string;
  data_horario: string;
}

export interface EventoCartaoAmarelo {
  baba_id: string;
  quantidade: number;
}

export interface CartaoNaJanela {
  baba_id: string;
  dataHorario: string | null;
  quantidade: number;
}

export interface SituacaoAmarelos {
  /** Cartões amarelos contados na janela atual. */
  amarelosNaJanela: number;
  limite: number;
  janela: number;
  /** Atingiu o limite: suspenso do próximo baba. */
  suspenso: boolean;
  /** Está a 1 de atingir (ex.: 2 cartões com limite 3) — em risco. */
  emRisco: boolean;
  /** Data em que o cartão mais antigo sai da janela (ou null se indefinida). */
  expiraEm: Date | null;
  /** Quantos babas faltam até o cartão mais antigo sair da janela. */
  babasRestantes: number;
  cartoesNaJanela: CartaoNaJanela[];
}

export function situacaoCartoesAmarelos(opts: {
  /** Todos os babas (com data_horario), passados ou futuros. */
  babas: BabaComData[];
  /** Cartões amarelos do usuário por baba. */
  eventos: EventoCartaoAmarelo[];
  janela: number;
  limite: number;
  agora?: Date;
}): SituacaoAmarelos {
  const agora = opts.agora ?? new Date();
  const janela = Math.max(1, opts.janela);
  const limite = Math.max(1, opts.limite);
  const porData = (d: string) => new Date(d).getTime();

  const todas = [...opts.babas].sort((a, b) => porData(a.data_horario) - porData(b.data_horario));
  const realizados = todas.filter((b) => porData(b.data_horario) <= agora.getTime());
  const naJanelaIds = new Set(realizados.slice(-janela).map((b) => b.id));

  const cartoesNaJanela: CartaoNaJanela[] = opts.eventos
    .filter((e) => naJanelaIds.has(e.baba_id))
    .map((e) => {
      const baba = todas.find((b) => b.id === e.baba_id);
      return {
        baba_id: e.baba_id,
        dataHorario: baba?.data_horario ?? null,
        quantidade: e.quantidade,
      };
    })
    .sort((a, b) => {
      if (!a.dataHorario) return 1;
      if (!b.dataHorario) return -1;
      return porData(a.dataHorario) - porData(b.dataHorario);
    });

  const amarelosNaJanela = cartoesNaJanela.reduce((s, c) => s + c.quantidade, 0);

  // Cartão mais antigo dentro da janela: expira quando `janela` babas
  // acontecerem depois dele (ele sai da "última N babas").
  const maisAntigo = cartoesNaJanela[0] ?? null;
  let expiraEm: Date | null = null;
  let babasRestantes = 0;
  if (maisAntigo?.dataHorario) {
    const idx = todas.findIndex((b) => b.id === maisAntigo.baba_id);
    if (idx >= 0) {
      const idxExpira = idx + janela;
      const babaExpira = todas[idxExpira];
      if (babaExpira) {
        expiraEm = new Date(babaExpira.data_horario);
        babasRestantes = Math.max(0, idxExpira - (realizados.length - 1));
      } else {
        babasRestantes = Math.max(0, idxExpira - (todas.length - 1));
      }
    }
  }

  return {
    amarelosNaJanela,
    limite,
    janela,
    suspenso: amarelosNaJanela >= limite,
    emRisco: amarelosNaJanela === limite - 1 && amarelosNaJanela > 0,
    expiraEm,
    babasRestantes,
    cartoesNaJanela,
  };
}
