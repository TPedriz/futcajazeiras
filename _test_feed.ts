// Testes da lógica do Feed Social de Gamificação (espelham as regras do banco).
// Rode com: node _test_feed.ts
import {
  rotuloRaridade,
  rotuloTipoEvento,
  classesRaridade,
  metadataEvento,
  textoApoioEvento,
  dataRelativa,
  chaveConquista,
  chaveMarca,
  chaveNivel,
  chaveRanking,
  chaveHistorico,
  EVENTOS_IMPORTANTES,
  type TipoEventoFeed,
} from "./src/lib/feed.ts";

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

// ---------- Raridade ----------
ok("raridade comum", rotuloRaridade("comum") === "Comum");
ok("raridade incomum", rotuloRaridade("incomum") === "Incomum");
ok("raridade rara", rotuloRaridade("rara") === "Rara");
ok("raridade epica", rotuloRaridade("epica") === "Épica");
ok("raridade lendaria", rotuloRaridade("lendaria") === "Lendária");
ok("raridade mitica", rotuloRaridade("mitica") === "Mítica");
ok("raridade desconhecida cai p/ comum", rotuloRaridade("xyz") === "Comum");
ok("raridade nula cai p/ comum", rotuloRaridade(null) === "Comum");

// Visual: bloqueada sempre opaca; rara+ com glow próprio.
ok(
  "bloqueada => opaca/cinza",
  classesRaridade("epica", false).includes("grayscale") &&
    classesRaridade("epica", false).includes("opacity-45"),
);
ok("lendaria => token gold", classesRaridade("lendaria", true).includes("text-gold"));
ok("epica => token violeta", classesRaridade("epica", true).includes("text-violet-300"));
ok("comum => token gold suave", classesRaridade("comum", true).includes("text-gold"));

// ---------- Rótulos de tipo ----------
ok("rótulo CONQUISTA_RARA", rotuloTipoEvento("CONQUISTA_RARA") === "Conquista rara!");
ok("rótulo NIVEL_ALCANCADO", rotuloTipoEvento("NIVEL_ALCANCADO") === "Nível alcançado");
ok("rótulo RANKING_ALCANCADO", rotuloTipoEvento("RANKING_ALCANCADO") === "Ranking");
ok("rótulo desconhecido => o próprio tipo", rotuloTipoEvento("XYZ") === "XYZ");

// ---------- Eventos importantes (toast) ----------
ok("CONQUISTA_RARA é importante", EVENTOS_IMPORTANTES.has("CONQUISTA_RARA" as TipoEventoFeed));
ok(
  "NIVEL_ALCANCADO NÃO é evento de toast (bolha já cobre)",
  !EVENTOS_IMPORTANTES.has("NIVEL_ALCANCADO" as TipoEventoFeed),
);

// ---------- Metadata ----------
ok("metadata vazia => {}", Object.keys(metadataEvento(undefined)).length === 0);
ok("metadata inválida => {}", Object.keys(metadataEvento("texto")).length === 0);
ok("metadata lê campo", metadataEvento({ nivel_novo: 10, xp_total: 1000 }).nivel_novo === 10);

// ---------- Texto de apoio (renderização sem texto livre) ----------
ok(
  "apoio: nível mostra XP total",
  textoApoioEvento({
    tipo: "NIVEL_ALCANCADO",
    descricao: "",
    metadata: { nivel_novo: 10, xp_total: 1000 },
  }) === "1000 XP acumulados",
);
ok(
  "apoio: conquista mostra meta + categoria",
  textoApoioEvento({
    tipo: "CONQUISTA_RARA",
    descricao: "Marque 100 gols no total.",
    metadata: { meta: 100, categoria: "gols" },
  }) === "100 gols",
);
ok(
  "apoio: marca histórica",
  textoApoioEvento({
    tipo: "MARCA_ATINGIDA",
    descricao: "",
    metadata: { meta: 100, categoria: "gols" },
  }).includes("marca histórica"),
);
ok(
  "apoio: ranking top 1",
  textoApoioEvento({
    tipo: "RANKING_ALCANCADO",
    descricao: "",
    metadata: { categoria: "gols", posicao_nova: 1, valor: 42 },
  }).startsWith("1º lugar do mês em gols"),
);
ok(
  "apoio: ranking top 3",
  textoApoioEvento({
    tipo: "RANKING_ALCANCADO",
    descricao: "",
    metadata: { categoria: "assistencias", posicao_nova: 3, valor: 7 },
  }).startsWith("3º lugar do mês em assistências"),
);

// ---------- Datas relativas ----------
ok("data relativa: vazia", dataRelativa(null) === "");
ok(
  "data relativa: passado próximo contém 'há'",
  dataRelativa(new Date(Date.now() - 5 * 60 * 1000).toISOString()).includes("há"),
);

// ---------- Chaves de idempotência (espelham chave_unica do banco) ----------
ok(
  "chave conquista determinística",
  chaveConquista("u1", "c1") === "conquista:u1:c1" &&
    chaveConquista("u1", "c1") === chaveConquista("u1", "c1"),
);
ok("chave conquista difere por usuário", chaveConquista("u1", "c1") !== chaveConquista("u2", "c1"));
ok("chave marca", chaveMarca("u1", "c1") === "marca:u1:c1");
ok("chave nível por nível", chaveNivel("u1", 10) === "nivel:u1:10");
ok(
  "chave nível: mesmo usuário níveis diferentes => chaves diferentes",
  chaveNivel("u1", 10) !== chaveNivel("u1", 11),
);
ok(
  "chave ranking top1 vs top3",
  chaveRanking("u1", "2026-08-01", "gols", "top1") !==
    chaveRanking("u1", "2026-08-01", "gols", "top3"),
);
ok(
  "chave ranking muda por mês",
  chaveRanking("u1", "2026-08-01", "gols", "top1") !==
    chaveRanking("u1", "2026-09-01", "gols", "top1"),
);
ok("chave histórico", chaveHistorico("u1", "c1") === "historico:u1:c1");

// ---------- Idempotência: mesmo acontecimento não duplica ----------
// Modelo em memória que espelha INSERT ... ON CONFLICT (chave_unica) DO NOTHING.
function criaEventoIdempotente(registros: Map<string, number>, chave: string): boolean {
  if (registros.has(chave)) return false;
  registros.set(chave, 1);
  return true;
}

{
  const registros = new Map<string, number>();
  // Cenário: usuário com 99 gols marca o 100º gol => MATADOR desbloqueada.
  const chaveMatador = chaveConquista("thiago", "matador");
  ok("1ª vez: evento criado", criaEventoIdempotente(registros, chaveMatador) === true);
  // Repetir a operação (reavaliação de conquistas) não cria duplicata.
  ok("2ª vez: evento NÃO duplica", criaEventoIdempotente(registros, chaveMatador) === false);
  ok("3ª vez: evento NÃO duplica", criaEventoIdempotente(registros, chaveMatador) === false);
  ok("total de 1 registro", registros.size === 1);
}

{
  const registros = new Map<string, number>();
  // Nível: sobe de 9 -> 10 uma vez.
  ok("nível 10: evento criado", criaEventoIdempotente(registros, chaveNivel("carlos", 10)));
  // Permanecer no nível 10 (novas concessões de XP) não cria novo evento.
  ok("nível 10 repetido: NÃO duplica", !criaEventoIdempotente(registros, chaveNivel("carlos", 10)));
  // Sobe para 11 => evento novo (nível diferente).
  ok("nível 11: evento novo", criaEventoIdempotente(registros, chaveNivel("carlos", 11)));
  ok("total de 2 registros", registros.size === 2);
}

{
  const registros = new Map<string, number>();
  // Ranking: entra no Top 3 (top3) e depois assume o 1º (top1) — dois momentos.
  ok(
    "top3: evento criado",
    criaEventoIdempotente(registros, chaveRanking("lu", "2026-08-01", "gols", "top3")),
  );
  ok(
    "top3 repetido: NÃO duplica",
    !criaEventoIdempotente(registros, chaveRanking("lu", "2026-08-01", "gols", "top3")),
  );
  ok(
    "top1: evento criado",
    criaEventoIdempotente(registros, chaveRanking("lu", "2026-08-01", "gols", "top1")),
  );
  // Recalcular o ranking sem mudança não cria outro evento.
  ok(
    "recalcular sem mudança: NÃO duplica",
    !criaEventoIdempotente(registros, chaveRanking("lu", "2026-08-01", "gols", "top1")),
  );
  ok("total de 2 registros", registros.size === 2);
}

// ---------- Backfill: conquistas já existentes entram no feed ----------
// Espelha a migration 20260818010000_backfill_feed_conquistas.sql:
// cada usuario_conquistas existente vira um evento com a MESMA chave_unica
// da desbloqueia_conquista, então nunca duplica — nem com desbloqueios futuros.
{
  const registros = new Map<string, number>();

  // Conquistas que um usuário JÁ tinha antes do feed existir.
  const existentes = [
    { usuario: "thiago", conquista: "primeira_presenca", raridade: "comum" },
    { usuario: "thiago", conquista: "gols_10", raridade: "incomum" },
    { usuario: "thiago", conquista: "gols_100", raridade: "epica" }, // meta >= 100 -> + marca
    { usuario: "carlos", conquista: "nivel_10", raridade: "rara" },
  ];

  // Backfill (1ª execução): cria os eventos.
  for (const e of existentes) {
    ok(
      `backfill: evento criado p/ ${e.conquista}`,
      criaEventoIdempotente(registros, chaveConquista(e.usuario, e.conquista)),
    );
    if (e.conquista === "gols_100") {
      ok(
        "backfill: marca atingida criada",
        criaEventoIdempotente(registros, chaveMarca(e.usuario, e.conquista)),
      );
    }
  }

  // Backfill re-executado: não duplica.
  for (const e of existentes) {
    ok(
      `backfill 2ª vez: NÃO duplica ${e.conquista}`,
      !criaEventoIdempotente(registros, chaveConquista(e.usuario, e.conquista)),
    );
  }

  // Desbloqueio futuro (desbloqueia_conquista) com a MESMA chave: não duplica.
  ok(
    "desbloqueio futuro da mesma conquista: NÃO duplica",
    !criaEventoIdempotente(registros, chaveConquista("thiago", "gols_100")),
  );

  // Nova conquista desbloqueada depois do backfill: cria normalmente.
  ok(
    "conquista nova após backfill: evento criado",
    criaEventoIdempotente(registros, chaveConquista("thiago", "presencas_100")),
  );

  // Históricas (categoria 'historica') ficam de fora do backfill — o
  // concede_conquista_historica gera evento próprio (chave historico:...).
  ok(
    "histórica NÃO entra no backfill (chave conquista)",
    !registros.has(chaveConquista("thiago", "fundador")),
  );

  // Contagem final: 5 eventos de conquista + 1 marca (sem duplicatas).
  const esperado = existentes.length + 1 + 1; // 4 conquistas + marca(gols_100) + presencas_100
  ok("backfill: total correto (sem duplicatas)", registros.size === esperado);
}

// ---------- Segurança: usuário não fabrica evento (espelha RLS) ----------
function rlsPodeInserirFeed(papel: "anon" | "convidado" | "associado" | "administrador"): boolean {
  // Sem política de INSERT para authenticated => ninguém insere pelo navegador.
  return papel === "administrador" && false; // admin também não insere direto; só via SECURITY DEFINER
}
ok("anon NÃO insere evento", !rlsPodeInserirFeed("anon"));
ok("convidado NÃO insere evento", !rlsPodeInserirFeed("convidado"));
ok("associado NÃO insere evento", !rlsPodeInserirFeed("associado"));
ok("admin NÃO insere evento direto (via função/trigger)", !rlsPodeInserirFeed("administrador"));

function rlsPodeLerFeed(autenticado: boolean, visibilidade: string): boolean {
  return autenticado && visibilidade === "VISIVEL";
}
ok("autenticado lê evento VISIVEL", rlsPodeLerFeed(true, "VISIVEL"));
ok("autenticado NÃO lê OCULTO", !rlsPodeLerFeed(true, "OCULTO"));
ok("não autenticado NÃO lê", !rlsPodeLerFeed(false, "VISIVEL"));

// ---------- Raridade do catálogo (regra do banco por meta) ----------
function raridadePorMeta(meta: number): string {
  if (meta >= 250) return "lendaria";
  if (meta >= 100) return "epica";
  if (meta >= 50) return "rara";
  if (meta >= 25) return "incomum";
  if (meta >= 10) return "incomum";
  return "comum";
}
ok("meta 1 => comum", raridadePorMeta(1) === "comum");
ok("meta 10 => incomum", raridadePorMeta(10) === "incomum");
ok("meta 50 => rara", raridadePorMeta(50) === "rara");
ok("meta 100 => epica", raridadePorMeta(100) === "epica");
ok("meta 250 => lendaria", raridadePorMeta(250) === "lendaria");

console.log(`\n${total - falhas}/${total} testes passaram`);
if (falhas > 0) process.exit(1);
