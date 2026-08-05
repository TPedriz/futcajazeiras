// Testes de validação do fluxo de CHECK-IN presencial (regras do cliente + janela).
// Rode com: node _test_checkin.ts
import type { JogadorSorteio } from "./src/lib/sorteio.ts";

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

// ---------- Janela do check-in presencial (espelha janelaChegada do ChegadaGps) ----------
function janelaChegada(dataHorario: string) {
  const jogo = new Date(dataHorario);
  const abertura = new Date(jogo.getTime() - 30 * 60 * 1000);
  const limite = new Date(jogo.getTime() + 60 * 60 * 1000);
  return { abertura, limite };
}

const jogo = "2026-08-05T19:00:00";
const { abertura, limite } = janelaChegada(jogo);
const ABRE = abertura.getTime();
const FECHA = limite.getTime();

ok("janela: abre 30min antes", ABRE === new Date("2026-08-05T18:30:00").getTime());
ok("janela: encerra 1h depois", FECHA === new Date("2026-08-05T20:00:00").getTime());
ok("janela: 29min antes ainda fechado", ABRE - 60000 < ABRE);
ok("janela: dentro da janela permite", ABRE + 1000 >= ABRE && ABRE + 1000 <= FECHA);

// ---------- Quem tem acesso (espelha o fluxo do app) ----------
type Ctx = {
  naLista: boolean;
  suspenso?: boolean;
  inadimplente?: boolean;
  contaAtiva?: boolean;
  admin?: boolean;
  isConvidado?: boolean;
  dentroDoRaio?: boolean;
};
function podeMarcarChegada(ctx: Ctx, agora: number): { ok: boolean; motivo?: string } {
  if (!ctx.naLista)
    return { ok: false, motivo: "Confirme sua presença na lista antes de marcar a chegada." };
  if (ctx.contaAtiva === false) return { ok: false, motivo: "Conta desativada." };
  if (ctx.suspenso) return { ok: false, motivo: "Suspenso neste baba." };
  if (ctx.inadimplente) return { ok: false, motivo: "Mensalidade em aberto." };
  // Admin ignora janela E raio (espelha o IF NOT tem_papel(admin) do marcar_chegada).
  if (ctx.admin) return { ok: true };
  if (agora < ABRE) return { ok: false, motivo: "Ainda não abriu." };
  if (agora > FECHA) return { ok: false, motivo: "Janela encerrada." };
  if (ctx.dentroDoRaio === false) return { ok: false, motivo: "Fora da arena." };
  return { ok: true };
}

const DENTRO = ABRE + 5 * 60000; // 5 min após abrir
ok(
  "check-in: associado na lista, em dia, no raio → OK",
  podeMarcarChegada({ naLista: true, contaAtiva: true, dentroDoRaio: true }, DENTRO).ok,
);
ok(
  "check-in: quem NÃO está na lista → bloqueado",
  !podeMarcarChegada({ naLista: false }, DENTRO).ok,
);
ok(
  "check-in: suspenso → bloqueado",
  !podeMarcarChegada({ naLista: true, suspenso: true, dentroDoRaio: true }, DENTRO).ok,
);
ok(
  "check-in: inadimplente → bloqueado",
  !podeMarcarChegada({ naLista: true, inadimplente: true, dentroDoRaio: true }, DENTRO).ok,
);
ok(
  "check-in: conta desativada → bloqueado",
  !podeMarcarChegada({ naLista: true, contaAtiva: false, dentroDoRaio: true }, DENTRO).ok,
);
ok(
  "check-in: fora da arena → bloqueado (não-admin)",
  !podeMarcarChegada({ naLista: true, dentroDoRaio: false }, DENTRO).ok,
);
ok(
  "check-in: admin ignora raio/janela (lat 0, lng 0)",
  podeMarcarChegada({ naLista: true, admin: true, dentroDoRaio: false }, FECHA + 60000).ok,
);
ok(
  "check-in: antes da janela → bloqueado",
  !podeMarcarChegada({ naLista: true, dentroDoRaio: true }, ABRE - 60000).ok,
);

// ---------- Fila de chegada: ordenação por ordem_chegada ----------
const chegados = [
  { id: "a", ordem_chegada: 3, chegou_em: "2026-08-05T19:05:00" },
  { id: "b", ordem_chegada: 1, chegou_em: "2026-08-05T18:40:00" },
  { id: "c", ordem_chegada: 2, chegou_em: "2026-08-05T19:00:00" },
];
const fila = chegados
  .filter((p) => p.ordem_chegada != null)
  .sort((a, b) => (a.ordem_chegada ?? 0) - (b.ordem_chegada ?? 0));
ok("fila: ordena por ordem de chegada", fila.map((f) => f.id).join("") === "bca");

// ---------- Chave de chegada usada no sorteio (chegouEm → ordem_chegada) ----------
function chaveChegada(j: JogadorSorteio): number {
  if (j.chegouEm) return new Date(j.chegouEm).getTime();
  if (j.ordemChegada != null) return j.ordemChegada;
  return Number.MAX_SAFE_INTEGER;
}
const semChegada = {
  id: "x",
  nome: "X",
  posicao: "linha" as const,
  isConvidado: false,
  ordemChegada: null,
  chegouEm: null,
};
ok(
  "sorteio: sem chegada vai pro fim da fila",
  chaveChegada(semChegada) === Number.MAX_SAFE_INTEGER,
);
ok(
  "sorteio: chegouEm tem prioridade sobre ordem",
  chaveChegada({ ...semChegada, chegouEm: "2026-08-05T18:30:00", ordemChegada: 5 }) <
    chaveChegada({ ...semChegada, chegouEm: "2026-08-05T19:30:00", ordemChegada: 1 }),
);

console.log(`\n${total - falhas}/${total} testes passaram`);
if (falhas > 0) process.exit(1);
