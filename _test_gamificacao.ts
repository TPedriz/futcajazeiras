// Testes da lógica de gamificação (destaques por categoria).
// Rode com: node _test_gamificacao.ts
import {
  rankingDeCategoria,
  destaquesDoUsuario,
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

console.log(`\n${total - falhas}/${total} testes passaram`);
if (falhas > 0) process.exit(1);
