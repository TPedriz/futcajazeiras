/**
 * Algoritmo de Sorteio de Times — Fut Cajazeiras
 *
 * Regras atuais:
 * - NINGUÉM fica de reserva: todos os jogadores confirmados entram em algum time.
 * - Número de times = teto(total / tamanho). O último time pode ficar incompleto.
 * - Goleiros são distribuídos 1 por time; goleiros sobressalentes viram linha.
 * - Modo BAxVI: divide os associados entre Time Bahia e Time Vitória pelo time do coração.
 */

export type Posicao = "goleiro" | "linha";
export type TimeCoracao = "bahia" | "vitoria";

export interface JogadorSorteio {
  id: string;
  nome: string;
  posicao: Posicao;
  isConvidado: boolean;
  timeCoracao?: TimeCoracao | null;
  /** Ordem de chegada registrada pelo check-in por GPS. */
  ordemChegada?: number | null;
  /** Timestamp do check-in presencial (chegou_em) — usado para ordenar a fila. */
  chegouEm?: string | null;
  /** Goleiro marcado como "Fixo" pela diretoria: cobre mais de um time no sorteio. */
  isGoleiroFixo?: boolean;
}

export interface TimeSorteado {
  numero: number;
  nome: string;
  goleiro: JogadorSorteio | null;
  linha: JogadorSorteio[];
}

/**
 * Estado do sorteio "Ordem de Chegada" em duas etapas.
 * - times: times montados até o momento.
 * - alocados: ids (de presença) que já têm time — base do "diff" da 2ª etapa.
 * - fixoIndice: posição do round-robin de goleiros fixos (continua na 2ª etapa).
 * - deficit: true quando faltou goleiro e um jogador de linha foi promovido.
 */
export interface SorteioEstado {
  times: TimeSorteado[];
  alocados: string[];
  fixoIndice: number;
  deficit: boolean;
}

export const TAMANHOS_TIME = [6, 7] as const;
export type TamanhoTime = (typeof TAMANHOS_TIME)[number];

const LETRAS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"];

function embaralhar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Ordena pela chegada: timestamp do check-in presencial (chegou_em), com fallback para ordem_chegada. */
function chaveChegada(j: JogadorSorteio): number {
  if (j.chegouEm) return new Date(j.chegouEm).getTime();
  if (j.ordemChegada != null) return j.ordemChegada;
  return Number.MAX_SAFE_INTEGER;
}

function porChegada(lista: JogadorSorteio[]): JogadorSorteio[] {
  return [...lista].sort((a, b) => chaveChegada(a) - chaveChegada(b));
}

/** Preenche times sem goleiro: normais (ordem de chegada) → fixos (round-robin) → déficit (linha promovida). */
function alocarGoleiros(
  times: TimeSorteado[],
  goleirosNormais: JogadorSorteio[],
  fixos: JogadorSorteio[],
  fixoIndiceInicial: number,
): { fixoIndice: number; deficit: boolean; sobrando: JogadorSorteio[] } {
  const sobrando: JogadorSorteio[] = [];

  // 1) Goleiros normais em ordem de chegada, um por time (em ordem).
  let gi = 0;
  for (const t of times) {
    if (gi >= goleirosNormais.length) break;
    if (!t.goleiro) t.goleiro = goleirosNormais[gi++];
  }
  sobrando.push(...goleirosNormais.slice(gi));

  // 2) Goleiros fixos em round-robin para os times que ainda não têm goleiro.
  let fixoIndice = fixoIndiceInicial;
  const fixosUsados = new Set<number>();
  for (const t of times) {
    if (t.goleiro) continue;
    if (fixos.length === 0) break;
    const idx = fixoIndice % fixos.length;
    t.goleiro = fixos[idx];
    fixosUsados.add(idx);
    fixoIndice++;
  }
  // Fixos que não foram necessários: também entram (viram linha, se precisar).
  for (let i = 0; i < fixos.length; i++) {
    if (!fixosUsados.has(i)) sobrando.push(fixos[i]);
  }

  // 3) Déficit: sem goleiro nenhum disponível, promove um jogador de linha.
  let deficit = false;
  for (const t of times) {
    if (!t.goleiro && t.linha.length > 0) {
      const promovido = t.linha.shift()!;
      t.goleiro = { ...promovido, posicao: "goleiro" };
      deficit = true;
    }
  }

  return { fixoIndice, deficit, sobrando };
}

/** Goleiros em excesso viram linha e são encaixados nos times menos cheios (ninguém fica de fora). */
function distribuirSobras(times: TimeSorteado[], sobras: JogadorSorteio[]): TimeSorteado[] {
  const contagem = (t: TimeSorteado) => (t.goleiro ? 1 : 0) + t.linha.length;
  const alvo = [...times];
  for (const s of sobras) {
    let melhor = 0;
    for (let i = 1; i < alvo.length; i++) {
      if (contagem(alvo[i]) < contagem(alvo[melhor])) melhor = i;
    }
    alvo[melhor].linha.push({ ...s, posicao: "linha" });
  }
  return alvo;
}

function coletarAlocados(times: TimeSorteado[]): string[] {
  const ids: string[] = [];
  for (const t of times) {
    if (t.goleiro) ids.push(t.goleiro.id);
    for (const j of t.linha) ids.push(j.id);
  }
  return ids;
}

function renumerar(times: TimeSorteado[]): TimeSorteado[] {
  return times.map((t, i) => ({ ...t, numero: i + 1, nome: `Time ${LETRAS[i] ?? i + 1}` }));
}

/**
 * 1ª etapa do sorteio por ordem de chegada.
 * - Times A e B: 12 primeiros jogadores de linha (embaralhados, 6 para cada).
 * - Demais de linha: sequenciais em blocos -> Time C, D, ...
 * - Goleiros: normais em ordem de chegada; depois fixos em round-robin; déficit vira linha promovida.
 */
export function sortearPrimeiroChegada(
  jogadores: JogadorSorteio[],
  tamanhoTime: number = 7,
): SorteioEstado {
  const tam = Math.max(2, Math.floor(tamanhoTime));
  const linhaPorTime = tam - 1; // 6 por padrão (1 goleiro + 6 linha = 7)

  const fila = porChegada(jogadores);
  const fixos = fila.filter((j) => j.posicao === "goleiro" && j.isGoleiroFixo);
  const goleiros = fila.filter((j) => j.posicao === "goleiro" && !j.isGoleiroFixo);
  const linha = fila.filter((j) => j.posicao === "linha");

  const times: TimeSorteado[] = [];
  const criar = (l: JogadorSorteio[]) =>
    times.push({
      numero: times.length + 1,
      nome: `Time ${LETRAS[times.length] ?? times.length + 1}`,
      goleiro: null,
      linha: l,
    });

  // Times A e B prioritários: 12 primeiros de linha, embaralhados, 6 para cada.
  const primeiros = embaralhar(linha.slice(0, linhaPorTime * 2));
  criar(primeiros.slice(0, linhaPorTime));
  criar(primeiros.slice(linhaPorTime));

  // Restante da linha: sequencial em blocos.
  const restante = linha.slice(linhaPorTime * 2);
  for (let i = 0; i < restante.length; i += linhaPorTime) {
    criar(restante.slice(i, i + linhaPorTime));
  }

  // Descarta times vazios (caso extremo de poucos jogadores).
  let ts = times.filter((t) => t.goleiro || t.linha.length > 0);
  if (ts.length === 0 && jogadores.length > 0) {
    ts = [{ numero: 1, nome: "Time A", goleiro: null, linha: [] }];
  }

  const { fixoIndice, deficit, sobrando } = alocarGoleiros(ts, goleiros, fixos, 0);
  const final = distribuirSobras(renumerar(ts), sobrando);

  return { times: final, alocados: coletarAlocados(final), fixoIndice, deficit };
}

/**
 * 2ª etapa do sorteio por ordem de chegada (retardatários).
 * Lista alvo = check-ins atuais - já alocados. Preenche o último time incompleto,
 * cria times novos se precisar e continua o round-robin de goleiros fixos de onde parou.
 */
export function sortearSegundoChegada(
  jogadores: JogadorSorteio[],
  estado: SorteioEstado,
  tamanhoTime: number = 7,
): SorteioEstado {
  const tam = Math.max(2, Math.floor(tamanhoTime));
  const linhaPorTime = tam - 1;

  const alocadosSet = new Set(estado.alocados);
  const novos = porChegada(jogadores.filter((j) => !alocadosSet.has(j.id)));

  const times = estado.times.map((t) => ({ ...t, linha: [...t.linha] }));

  const fixos = jogadores.filter((j) => j.posicao === "goleiro" && j.isGoleiroFixo);
  const goleirosNovos = novos.filter((j) => j.posicao === "goleiro" && !j.isGoleiroFixo);
  const linhaNovos = novos.filter((j) => j.posicao === "linha");

  // 1) Último time incompleto recebe os retardatários de linha primeiro.
  let idxIncompleto = -1;
  for (let i = times.length - 1; i >= 0; i--) {
    if (times[i].linha.length < linhaPorTime) {
      idxIncompleto = i;
      break;
    }
  }
  let iLinha = 0;
  if (idxIncompleto >= 0) {
    const t = times[idxIncompleto];
    while (t.linha.length < linhaPorTime && iLinha < linhaNovos.length) {
      t.linha.push(linhaNovos[iLinha++]);
    }
  }

  // 2) Sobra de linha: novos times.
  while (iLinha < linhaNovos.length) {
    const bloco = linhaNovos.slice(iLinha, iLinha + linhaPorTime);
    iLinha += bloco.length;
    times.push({
      numero: times.length + 1,
      nome: `Time ${LETRAS[times.length] ?? times.length + 1}`,
      goleiro: null,
      linha: bloco,
    });
  }

  // 3) Goleiros: normais recém-chegados; depois fixos continuando o round-robin.
  const { fixoIndice, deficit, sobrando } = alocarGoleiros(
    times,
    goleirosNovos,
    fixos,
    estado.fixoIndice,
  );

  // Goleiros fixos que já foram alocados na 1ª etapa não podem voltar (evita duplicidade).
  const jaAlocados = new Set(estado.alocados);
  const finalTmp = distribuirSobras(
    renumerar(times),
    sobrando.filter((s) => !jaAlocados.has(s.id)),
  );

  // Ninguém fica de fora: retardatário que ainda não entrou em time vira linha.
  const idsTmp = new Set(coletarAlocados(finalTmp));
  const restantes = novos
    .filter((n) => !idsTmp.has(n.id))
    .map((n) => ({ ...n, posicao: "linha" as const }));
  const final = distribuirSobras(finalTmp, restantes);

  return {
    times: final,
    alocados: coletarAlocados(final),
    fixoIndice,
    deficit: estado.deficit || deficit,
  };
}

export function sortearTimes(
  jogadores: JogadorSorteio[],
  tamanhoTime: number = 7,
): { times: TimeSorteado[]; sobras: JogadorSorteio[] } {
  const tam = Math.max(2, Math.floor(tamanhoTime));
  if (jogadores.length === 0) return { times: [], sobras: [] };

  // Todo mundo joga: arredondamos para cima, o último time pode ficar incompleto.
  const totalTimes = Math.max(1, Math.ceil(jogadores.length / tam));
  const goleiros = embaralhar(jogadores.filter((j) => j.posicao === "goleiro"));
  const linha = embaralhar(jogadores.filter((j) => j.posicao === "linha"));

  const times: TimeSorteado[] = Array.from({ length: totalTimes }, (_, i) => ({
    numero: i + 1,
    nome: `Time ${LETRAS[i] ?? i + 1}`,
    goleiro: null,
    linha: [],
  }));

  for (let i = 0; i < totalTimes && goleiros.length > 0; i++) {
    times[i].goleiro = goleiros.shift()!;
  }

  const pool = embaralhar([
    ...linha,
    ...goleiros.map((g) => ({ ...g, posicao: "linha" as const })),
  ]);

  // Primeiro completa cada time até o tamanho padrão...
  for (const time of times) {
    const necessarios = (time.goleiro ? tam - 1 : tam) - time.linha.length;
    for (let i = 0; i < necessarios && pool.length > 0; i++) {
      time.linha.push(pool.shift()!);
    }
  }
  // ...e se ainda sobrar alguém, distribui em rodízio. Ninguém fica de fora.
  let idx = 0;
  while (pool.length > 0) {
    times[idx % times.length].linha.push(pool.shift()!);
    idx++;
  }

  return { times, sobras: [] };
}

/** Modo BAxVI: Bahia contra Vitória, todos os associados entram. */
export function sortearBaxVi(jogadores: JogadorSorteio[]): {
  times: TimeSorteado[];
  semTime: JogadorSorteio[];
} {
  const bahia = embaralhar(jogadores.filter((j) => j.timeCoracao === "bahia"));
  const vitoria = embaralhar(jogadores.filter((j) => j.timeCoracao === "vitoria"));
  const semTime = jogadores.filter((j) => j.timeCoracao !== "bahia" && j.timeCoracao !== "vitoria");

  const montar = (numero: number, nome: string, grupo: JogadorSorteio[]): TimeSorteado => {
    const goleiro = grupo.find((j) => j.posicao === "goleiro") ?? null;
    return {
      numero,
      nome,
      goleiro,
      linha: grupo.filter((j) => j.id !== goleiro?.id),
    };
  };

  return {
    times: [montar(1, "Time Bahia", bahia), montar(2, "Time Vitória", vitoria)],
    semTime,
  };
}

export function formatarTimesParaWhatsApp(
  times: TimeSorteado[],
  sobras: JogadorSorteio[],
  dataBaba?: string,
): string {
  const linhas: string[] = [];
  linhas.push("⚽ *FUT CAJAZEIRAS — TIMES SORTEADOS* ⚽");
  if (dataBaba) linhas.push(`📅 ${dataBaba}`);
  linhas.push("");

  for (const time of times) {
    linhas.push(`🔴 *${time.nome}*`);
    if (time.goleiro) {
      linhas.push(
        `🧤 ${time.goleiro.isGoleiroFixo ? "🔒 " : ""}${time.goleiro.nome}${time.goleiro.isConvidado ? " (convidado)" : ""}`,
      );
    } else {
      linhas.push("🧤 _sem goleiro fixo_");
    }
    time.linha.forEach((j, i) => {
      linhas.push(`${i + 1}. ${j.nome}${j.isConvidado ? " (convidado)" : ""}`);
    });
    linhas.push("");
  }

  if (sobras.length > 0) {
    linhas.push("*Sem time definido*");
    sobras.forEach((s) => linhas.push(`• ${s.nome}`));
  }

  return linhas.join("\n");
}

/**
 * Modo "Ordem de Chegada" em duas etapas — implementado por:
 * - sortearPrimeiroChegada()  -> 1ª etapa (times A, B, C... + goleiros fixos)
 * - sortearSegundoChegada()   -> 2ª etapa (diff/retardatários)
 */
