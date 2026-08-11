// Testes da janela de cartões amarelos (src/lib/situacaoAmarelos.ts).
// Rode com: node _test_amarelos.ts
import { situacaoCartoesAmarelos } from "./src/lib/situacaoAmarelos.ts";

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

// Babas semanais: passados e futuros.
const babas = [
  "2026-08-03T19:00:00",
  "2026-08-10T19:00:00",
  "2026-08-17T19:00:00",
  "2026-08-24T19:00:00",
  "2026-08-31T19:00:00",
  "2026-09-07T19:00:00",
  "2026-09-14T19:00:00",
].map((d, i) => ({ id: `b${i + 1}`, data_horario: d }));

// "Agora" = 12/08: apenas b1 e b2 aconteceram.
const agora = new Date("2026-08-12T00:00:00");

// 2 amarelos (b1 e b2) na janela 5 com limite 3 -> em risco, expira em 07/09.
{
  const s = situacaoCartoesAmarelos({
    babas,
    eventos: [
      { baba_id: "b1", quantidade: 1 },
      { baba_id: "b2", quantidade: 1 },
    ],
    janela: 5,
    limite: 3,
    agora,
  });
  ok("2 amarelos na janela", s.amarelosNaJanela === 2);
  ok("em risco (2 de 3)", s.emRisco === true);
  ok("não suspenso ainda", s.suspenso === false);
  ok(
    "cartão mais antigo expira em 07/09",
    s.expiraEm?.toISOString().startsWith("2026-09-07") === true,
  );
  ok("faltam 4 babas para expirar", s.babasRestantes === 4);
}

// 3 amarelos (1 em b1 + 2 em b2) -> suspenso.
{
  const s = situacaoCartoesAmarelos({
    babas,
    eventos: [
      { baba_id: "b1", quantidade: 1 },
      { baba_id: "b2", quantidade: 2 },
    ],
    janela: 5,
    limite: 3,
    agora,
  });
  ok("3 amarelos = suspenso", s.suspenso === true);
  ok("suspenso não está 'em risco'", s.emRisco === false);
}

// 1 amarelo -> tranquilo.
{
  const s = situacaoCartoesAmarelos({
    babas,
    eventos: [{ baba_id: "b2", quantidade: 1 }],
    janela: 5,
    limite: 3,
    agora,
  });
  ok("1 amarelo = tranquilo", s.amarelosNaJanela === 1 && !s.emRisco && !s.suspenso);
}

// Cartão fora da janela não conta (janela 1 = só o b2 mais recente).
{
  const s = situacaoCartoesAmarelos({
    babas,
    eventos: [{ baba_id: "b1", quantidade: 2 }],
    janela: 1,
    limite: 3,
    agora,
  });
  ok("cartão fora da janela não conta", s.amarelosNaJanela === 0);
}

if (falhas > 0) {
  console.error(`\n${falhas} falha(s) de ${total} testes`);
  process.exit(1);
}
console.log(`\n${total}/${total} testes passaram`);
