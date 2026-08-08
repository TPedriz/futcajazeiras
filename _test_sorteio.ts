// Testes de validação: sorteio (1ª/2ª etapa, aleatório, BAxVI) e substituição.
// Rode com: node --experimental-strip-types _test_sorteio.mjs
import {
  sortearTimes,
  sortearBaxVi,
  sortearPrimeiroChegada,
  substituirJogador,
  idsAlocados,
  type JogadorSorteio,
} from "./src/lib/sorteio.ts";

let falhas = 0;
let total = 0;

function ok(nome, cond) {
  total++;
  if (!cond) {
    falhas++;
    console.error(`❌ ${nome}`);
  } else {
    console.log(`✅ ${nome}`);
  }
}

function gerarLinha(n, prefixo = "L") {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefixo}${i + 1}`,
    nome: `${prefixo}${i + 1}`,
    posicao: "linha",
    isConvidado: false,
    chegouEm: new Date(2026, 0, 1, 9 + i).toISOString(),
    ordemChegada: i + 1,
  }));
}
function gerarGoleiro(n, prefixo = "G", fixo = false) {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefixo}${i + 1}`,
    nome: `${prefixo}${i + 1}`,
    posicao: "goleiro",
    isConvidado: false,
    isGoleiroFixo: fixo,
    chegouEm: new Date(2026, 0, 1, 10 + i).toISOString(),
    ordemChegada: 100 + i,
  }));
}

// ---------- 1. Sorteio aleatório: ninguém fica de fora ----------
{
  const jogadores = [...gerarLinha(15), ...gerarGoleiro(3)];
  const r = sortearTimes(jogadores, 7);
  const alocados = new Set(idsAlocados(r.times));
  ok("aleatório: todos os 18 jogadores alocados", alocados.size === 18);
  ok("aleatório: sem duplicidade", alocados.size === new Set(jogadores.map((j) => j.id)).size);
  const sizes = r.times.map((t) => t.linha.length + (t.goleiro ? 1 : 0));
  ok("aleatório: 3 times formados", r.times.length === 3);
  // 3 goleiros p/ 3 times => cada time ganha 1 goleiro (sem excesso)
  ok(
    "aleatório: 1 goleiro por time (3 goleiros, 3 times)",
    r.times.filter((t) => t.goleiro).length === 3,
  );
  // Último time incompleto é permitido; ninguém fica de fora.
  ok("aleatório: ninguém ficou de fora (soma = 18)", sizes.reduce((a, b) => a + b, 0) === 18);
}

// ---------- 2. Ordem de chegada — sorteio único da LISTA COMPLETA ----------
{
  // 14 presentes (12 linha + 2 goleiros) + 6 na lista que ainda não chegaram (sem GPS)
  const linha = gerarLinha(12, "L");
  const goleiros = gerarGoleiro(2, "G");
  const naLista = gerarLinha(6, "N").map((j) => ({ ...j, chegouEm: null, ordemChegada: null }));
  const todos = [...linha, ...goleiros, ...naLista];
  const estado = sortearPrimeiroChegada(todos, 7);
  const alocados = new Set(idsAlocados(estado.times));
  ok("chegada: todos os 20 da lista alocados", alocados.size === 20);
  ok("chegada: sem duplicidade", alocados.size === new Set(todos.map((j) => j.id)).size);
  ok("chegada: Times A e B montados", estado.times.length >= 2);
  const tA = estado.times[0];
  ok("chegada: Time A tem 7 (goleiro + 6 linha)", !!tA.goleiro && tA.linha.length === 6);
  // Quem ainda não chegou entra nos times seguintes (não fica de fora)
  ok(
    "chegada: não-chegados entram nos times seguintes",
    estado.times
      .slice(2)
      .flatMap((t) => t.linha)
      .some((j) => j.id.startsWith("N")),
  );
  const total = estado.times.reduce((s, t) => s + (t.goleiro ? 1 : 0) + t.linha.length, 0);
  ok("chegada: soma dos times = 20", total === 20);
}

// ---------- 3. Anti-panelinha: retardatários espalhados, não em um time só ----------
{
  // 12 que chegaram cedo + 12 que chegaram tarde (todos na lista completa)
  const primeiros = gerarLinha(12, "L");
  const atrasados = gerarLinha(12, "T").map((j) => ({
    ...j,
    chegouEm: new Date(2026, 0, 1, 23).toISOString(), // chegaram no final
    ordemChegada: 500 + Number(j.id.slice(1)),
  }));
  const estado = sortearPrimeiroChegada([...primeiros, ...atrasados], 7);
  const timesComAtrasados = estado.times.filter((t) => t.linha.some((j) => j.id.startsWith("T")));
  ok("anti-panelinha: atrasados espalhados em mais de um time", timesComAtrasados.length > 1);
  ok("anti-panelinha: todos os 24 alocados", idsAlocados(estado.times).length === 24);
}

// ---------- 4. Substituição em qualquer sorteio ----------
{
  // 1ª etapa com 12 linha + 2 goleiros, depois substitui um alocado por um retardatário
  const linha = gerarLinha(12, "L");
  const goleiros = gerarGoleiro(2, "G");
  const estado1 = sortearPrimeiroChegada([...linha, ...goleiros], 7);

  // Cria um retardatário (não alocado)
  const reserva = {
    id: "RES1",
    nome: "Reserva 1",
    posicao: "linha",
    isConvidado: false,
    chegouEm: new Date(2026, 0, 1, 20).toISOString(),
    ordemChegada: 99,
  };
  const sairId = estado1.times[0].linha[0].id;

  const novos = substituirJogador(estado1.times, sairId, reserva);
  const alocadosNovos = new Set(idsAlocados(novos));
  ok("substituir: reserva entrou no time", alocadosNovos.has("RES1"));
  ok("substituir: quem saiu deixou de estar alocado", !alocadosNovos.has(sairId));
  ok("substituir: total segue 14", alocadosNovos.size === 14);
  // O substituto entrou na posição de linha do time 1
  const t1 = novos.find((t) => t.numero === 1);
  ok(
    "substituir: reserva está na linha do time 1",
    t1?.linha.some((j) => j.id === "RES1"),
  );
  ok("substituir: time continua com 7", t1 && t1.linha.length === 6 && t1.goleiro);
}

// ---------- 5. Substituição de goleiro ----------
{
  const linha = gerarLinha(12, "L");
  const goleiros = gerarGoleiro(2, "G");
  const estado1 = sortearPrimeiroChegada([...linha, ...goleiros], 7);
  const goleiroSai = estado1.times[0].goleiro;
  const reservaGoleiro = {
    id: "GRES",
    nome: "Goleiro Reserva",
    posicao: "goleiro",
    isConvidado: false,
  };
  const novos = substituirJogador(estado1.times, goleiroSai.id, reservaGoleiro);
  const t1 = novos.find((t) => t.numero === 1);
  ok("substituir goleiro: novo goleiro no lugar", t1?.goleiro?.id === "GRES");
  ok(
    "substituir goleiro: não duplica",
    new Set(idsAlocados(novos)).size === idsAlocados(novos).length,
  );
}

// ---------- 6. BAxVI ----------
{
  const bahia = gerarLinha(8, "B").map((j) => ({ ...j, timeCoracao: "bahia" }));
  const vitoria = gerarLinha(6, "V").map((j) => ({ ...j, timeCoracao: "vitoria" }));
  const semTime = gerarLinha(2, "X").map((j) => ({ ...j, timeCoracao: null }));
  const r = sortearBaxVi([...bahia, ...vitoria, ...semTime]);
  ok("baxvi: 2 times", r.times.length === 2);
  ok(
    "baxvi: Bahia tem 8, Vitória tem 6",
    r.times[0].linha.length === 8 && r.times[1].linha.length === 6,
  );
  ok("baxvi: 2 ficam sem time", r.semTime.length === 2);
}

// ---------- 7. Convidados aprovados entram; pendentes não ----------
{
  const aprovado = { id: "C1", nome: "Conv Aprovado", posicao: "linha", isConvidado: true };
  const r = sortearTimes([...gerarLinha(12), aprovado], 7);
  const alocados = new Set(idsAlocados(r.times));
  ok("aleatório: convidado aprovado entra", alocados.has("C1"));
}

console.log(`\n${total - falhas}/${total} testes passaram`);
if (falhas > 0) process.exit(1);
