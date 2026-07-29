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
}


export interface TimeSorteado {
  numero: number;
  nome: string;
  goleiro: JogadorSorteio | null;
  linha: JogadorSorteio[];
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
      linhas.push(`🧤 ${time.goleiro.nome}${time.goleiro.isConvidado ? " (convidado)" : ""}`);
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
