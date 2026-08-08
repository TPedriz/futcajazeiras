// Testes da lógica de gamificação (destaques por categoria, XP, níveis).
// Rode com: node _test_gamificacao.ts
import {
  rankingDeCategoria,
  destaquesDoUsuario,
  ganhoXp,
  xpNecessariaParaNivel,
  nivelParaXp,
  progressoNivel,
  type LinhaRankingDestaque,
} from "./src/lib/gamificacao.ts";

let falhas = 0;
let total = 0;
function ok(nome: string, cond: boolean) {
  total++;
  if (!cond) {
    falhas++;
    console.error(`❌ ${nome}`);
  } else {
    console.log(`✅ ${nome}`);
  }
}

const linhas: LinhaRankingDestaque[] = [
  {
    usuario_id: "a",
    gols: 10,
    assistencias: 2,
    penaltis_defendidos: 0,
    cartoes_amarelos: 1,
    cartoes_azuis: 0,
    cartoes_vermelhos: 0,
  },
  {
    usuario_id: "b",
    gols: 7,
    assistencias: 5,
    penaltis_defendidos: 1,
    cartoes_amarelos: 2,
    cartoes_azuis: 0,
    cartoes_vermelhos: 1,
  },
  {
    usuario_id: "c",
    gols: 10,
    assistencias: 0,
    penaltis_defendidos: 3,
    cartoes_amarelos: 0,
    cartoes_azuis: 0,
    cartoes_vermelhos: 0,
  },
  {
    usuario_id: "d",
    gols: 0,
    assistencias: 0,
    penaltis_defendidos: 0,
    cartoes_amarelos: 0,
    cartoes_azuis: 0,
    cartoes_vermelhos: 0,
  },
];

// Gols: a=10, c=10 (empate -> quem vem primeiro fica 1º), b=7, d=0 fora
const gols = rankingDeCategoria(linhas, "gols");
ok("gols: d (0 gols) fica fora", !gols.some((r) => r.usuario_id === "d"));
ok("gols: 3 jogadores no ranking", gols.length === 3);
ok("gols: a é 1º", gols[0].usuario_id === "a" && gols[0].posicao === 1);
ok("gols: b é 3º", gols[2].usuario_id === "b" && gols[2].posicao === 3);

// Pênaltis: c=3, b=1
const penaltis = rankingDeCategoria(linhas, "penaltis");
ok("penaltis: c é 1º", penaltis[0].usuario_id === "c" && penaltis[0].valor === 3);
ok("penaltis: b é 2º", penaltis[1].usuario_id === "b" && penaltis[1].posicao === 2);

// Cartões (soma): b = 2+0+1 = 3, a = 1
const cartoes = rankingDeCategoria(linhas, "cartoes");
ok("cartoes: b é 1º (3 cartões)", cartoes[0].usuario_id === "b" && cartoes[0].valor === 3);

// Destaques do usuário c (top 3): 1º em pênaltis, 2º em gols
const destC = destaquesDoUsuario(linhas, "c", 3);
ok("c: tem 2 destaques", destC.length === 2);
ok(
  "c: 1º em pênaltis",
  destC.some((d) => d.categoria === "penaltis" && d.posicao === 1),
);
ok(
  "c: 2º em gols",
  destC.some((d) => d.categoria === "gols" && d.posicao === 2),
);

// Destaques do usuário a (top 3): 1º em gols
const destA = destaquesDoUsuario(linhas, "a", 3);
ok(
  "a: 1º em gols",
  destA.some((d) => d.categoria === "gols" && d.posicao === 1),
);

// Destaques do usuário d: nenhum (não tem estatística > 0)
ok("d: sem destaques", destaquesDoUsuario(linhas, "d", 3).length === 0);

// Usuário inexistente: nenhum
ok("usuário inexistente: sem destaques", destaquesDoUsuario(linhas, "zzz", 3).length === 0);

// ---------- XP por evento ----------
ok("xp presença = 15", ganhoXp("presenca") === 15);
ok("xp gol = 8", ganhoXp("gol") === 8);
ok("xp assistência = 5", ganhoXp("assistencia") === 5);

// ---------- Níveis (regra do banco: 75 * n * (n-1) / 2) ----------
ok("nivel 1 exige 0 xp", xpNecessariaParaNivel(1) === 0);
ok("nivel 2 exige 75 xp", xpNecessariaParaNivel(2) === 75);
ok("nivel 3 exige 225 xp", xpNecessariaParaNivel(3) === 225);
ok("nivel 5 exige 750 xp", xpNecessariaParaNivel(5) === 750);

ok("0 xp -> nivel 1", nivelParaXp(0) === 1);
ok("74 xp -> nivel 1", nivelParaXp(74) === 1);
ok("75 xp -> nivel 2", nivelParaXp(75) === 2);
ok("224 xp -> nivel 2", nivelParaXp(224) === 2);
ok("225 xp -> nivel 3", nivelParaXp(225) === 3);
ok("1000 xp -> nivel 5", nivelParaXp(1000) === 5);
ok("xp negativo -> nivel 1", nivelParaXp(-50) === 1);

// ---------- Progresso dentro do nível ----------
{
  const p = progressoNivel(150);
  ok("150 xp -> nivel 2", p.nivel === 2);
  ok("150 xp: xpNoNivel = 75", p.xpNoNivel === 75);
  ok("nivel 2: xpParaProximo = 150 (225 - 75)", p.xpParaProximo === 150);
  ok("nivel 2: progresso = 0.5", Math.abs(p.progresso - 0.5) < 1e-9);
}
{
  const p = progressoNivel(0);
  ok("0 xp: progresso = 0", p.progresso === 0);
  ok("0 xp: xpParaProximo = 75", p.xpParaProximo === 75);
}
{
  const p = progressoNivel(225);
  ok("225 xp: nivel 3 e progresso 0", p.nivel === 3 && p.progresso === 0);
}

console.log(`\n${total - falhas}/${total} testes passaram`);
if (falhas > 0) process.exit(1);
