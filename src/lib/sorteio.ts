/**
 * Algoritmo de Sorteio de Times — Fut 7
 *
 * Regras:
 * - 7 jogadores por time (1 goleiro + 6 linha).
 * - Número de times = teto(confirmados / 7).
 * - Se há goleiros >= times: 1 goleiro por time, sorteados aleatoriamente. Sobressalentes viram linha.
 * - Se há goleiros < times: distribui 1 goleiro por vez nos primeiros N times; times restantes ficam sem goleiro fixo e completam 7 com linha.
 * - Preenchimento restante: sorteio aleatório de jogadores de linha.
 */

export type Posicao = "goleiro" | "linha";

export interface JogadorSorteio {
  id: string;
  nome: string;
  posicao: Posicao;
  isConvidado: boolean;
}

export interface TimeSorteado {
  numero: number;
  nome: string;
  goleiro: JogadorSorteio | null;
  linha: JogadorSorteio[];
}

const TAM_TIME = 7;
const LETRAS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function embaralhar<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sortearTimes(jogadores: JogadorSorteio[]): {
  times: TimeSorteado[];
  sobras: JogadorSorteio[];
} {
  if (jogadores.length < TAM_TIME) {
    return { times: [], sobras: jogadores };
  }

  const totalTimes = Math.floor(jogadores.length / TAM_TIME);
  const goleiros = embaralhar(jogadores.filter((j) => j.posicao === "goleiro"));
  const linha = embaralhar(jogadores.filter((j) => j.posicao === "linha"));

  const times: TimeSorteado[] = Array.from({ length: totalTimes }, (_, i) => ({
    numero: i + 1,
    nome: `Time ${LETRAS[i] ?? i + 1}`,
    goleiro: null,
    linha: [],
  }));

  // Distribui goleiros — 1 por time até esgotar
  for (let i = 0; i < totalTimes && goleiros.length > 0; i++) {
    times[i].goleiro = goleiros.shift()!;
  }

  // Goleiros sobressalentes viram linha
  const linhaTotal = [...linha, ...goleiros.map((g) => ({ ...g, posicao: "linha" as const }))];
  const poolLinha = embaralhar(linhaTotal);

  // Preenche cada time: quem tem goleiro precisa de 6 de linha; quem não tem, precisa de 7
  for (const time of times) {
    const necessarios = time.goleiro ? TAM_TIME - 1 : TAM_TIME;
    for (let i = 0; i < necessarios && poolLinha.length > 0; i++) {
      time.linha.push(poolLinha.shift()!);
    }
  }

  return { times, sobras: poolLinha };
}

export function formatarTimesParaWhatsApp(
  times: TimeSorteado[],
  sobras: JogadorSorteio[],
  dataBaba?: string
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
    linhas.push("*Reservas*");
    sobras.forEach((s) => linhas.push(`• ${s.nome}`));
  }

  return linhas.join("\n");
}
