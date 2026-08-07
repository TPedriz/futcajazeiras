// Testes da lógica de cartinhas de jogador (atributos, OVR e temas).
// Rode com: node _test_cartinha.ts
import {
  posicaoSigla,
  temaBasePorOvr,
  temaEfetivo,
  bonusNivel,
  calculaAtributos,
  type TemaCarta,
} from "./src/lib/cartinha.ts";

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

// ---------- Posição ----------
ok("posicao: goleiro -> GOL", posicaoSigla("goleiro") === "GOL");
ok("posicao: linha -> ATA", posicaoSigla("linha") === "ATA");

// ---------- Tema base por OVR ----------
ok("ovr 60 -> bronze", temaBasePorOvr(60) === "bronze");
ok("ovr 65 -> prata", temaBasePorOvr(65) === "prata");
ok("ovr 74 -> prata", temaBasePorOvr(74) === "prata");
ok("ovr 75 -> ouro", temaBasePorOvr(75) === "ouro");

// ---------- Tema efetivo (especiais têm prioridade) ----------
ok("top1Mes -> totw", temaEfetivo("bronze", { top1Mes: true }) === "totw");
ok("nivel 10 -> icon", temaEfetivo("prata", { nivel: 10 }) === "icon");
ok("presencas 100 -> icon", temaEfetivo("bronze", { presencas: 100 }) === "icon");
ok("goleiro destaque -> paredao", temaEfetivo("ouro", { goleiroDestaque: true }) === "paredao");
ok("sem contexto -> mantém base", temaEfetivo("prata", {}) === ("prata" as TemaCarta));

// ---------- Bônus de nível ----------
ok("bonus nivel 3 = 1", bonusNivel(3) === 1);
ok("bonus nivel 6 = 2", bonusNivel(6) === 2);
ok("bonus nivel 15 = 5", bonusNivel(15) === 5);
ok("bonus nivel 20 = 5 (máx)", bonusNivel(20) === 5);

// ---------- Atributos: jogador novato (sem nada) ----------
{
  const r = calculaAtributos({
    babasTotal: 10,
    presencas: 0,
    gols: 0,
    assistencias: 0,
    penaltisDefendidos: 0,
    cartoesAmarelos: 0,
    cartoesAzuis: 0,
    cartoesVermelhos: 0,
    vitorias: 0,
    nivel: 1,
    posicao: "linha",
  });
  ok("novato: PAC base 40", r.pac === 40);
  ok("novato: OVR em 40", r.ovr === 40);
}

// ---------- Atributos: jogador frequente e artilheiro ----------
{
  const r = calculaAtributos({
    babasTotal: 10,
    presencas: 10, // 100% de frequência
    gols: 20, // 2 gols por baba
    assistencias: 5, // 0.5 por baba
    penaltisDefendidos: 0,
    cartoesAmarelos: 1,
    cartoesAzuis: 0,
    cartoesVermelhos: 0,
    vitorias: 6, // 0.6 vitórias por baba
    nivel: 3,
    posicao: "linha",
  });
  ok("frequente: PAC alto (99)", r.pac === 99);
  ok("artilheiro: SHO = 70", r.sho === 70);
  ok("assistidor: PAS = 48", r.pas === 48);
  ok("vitorioso: DRI > 40", r.dri > 40);
  ok("disciplina: DEF > 40", r.def > 40);
  ok("ovr > 40 (bonus de nível)", r.ovr > 40);
  // PAC = 40 + 1*59 = 99
  // SHO = 40 + 2*15 = 70
  // PAS = 40 + 0.5*15 = 47.5 -> 48
  // DRI = 40 + 0.6*12 + 2*3 = 40 + 7.2 + 6 = 53.2 -> 53
  // DEF = 40 + 0.6*10 - 2 = 44
  // PHY = 40 + 0 + 0 + min(20, 6) = 46
  ok("valores esperados: DRI 53 / DEF 44 / PHY 46", r.dri === 53 && r.def === 44 && r.phy === 46);
}

// ---------- Goleiro com pênaltis defendidos ----------
{
  const r = calculaAtributos({
    babasTotal: 5,
    presencas: 5,
    gols: 0,
    assistencias: 0,
    penaltisDefendidos: 3,
    cartoesAmarelos: 0,
    cartoesAzuis: 0,
    cartoesVermelhos: 0,
    vitorias: 2,
    nivel: 2,
    posicao: "goleiro",
  });
  // PHY = 40 + 3*8 + 15 + min(20, 4) = 40 + 24 + 15 + 4 = 83
  ok("goleiro: PHY com bônus = 83", r.phy === 83);
}

// ---------- Cartões baixam a DEF ----------
{
  const r = calculaAtributos({
    babasTotal: 5,
    presencas: 5,
    gols: 0,
    assistencias: 0,
    penaltisDefendidos: 0,
    cartoesAmarelos: 2,
    cartoesAzuis: 0,
    cartoesVermelhos: 1,
    vitorias: 0,
    nivel: 1,
    posicao: "linha",
  });
  // DEF = 40 + 0 - 4 - 6 = 30
  ok("cartões: DEF = 30", r.def === 30);
}

// ---------- Clamp: nunca abaixo de 1 ----------
{
  const r = calculaAtributos({
    babasTotal: 1,
    presencas: 1,
    gols: 0,
    assistencias: 0,
    penaltisDefendidos: 0,
    cartoesAmarelos: 0,
    cartoesAzuis: 0,
    cartoesVermelhos: 10,
    vitorias: 0,
    nivel: 1,
    posicao: "linha",
  });
  ok("clamp: DEF >= 1 (60 vermelhos)", r.def >= 1);
}

console.log(`\n${total - falhas}/${total} testes passaram`);
if (falhas > 0) process.exit(1);
