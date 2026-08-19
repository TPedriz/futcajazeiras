// Testes da lógica da Rede Social + Agenda + Metas (espelham as regras do banco).
// Rode com: node --experimental-strip-types _test_rede_social.ts
import {
  normalizaInstagram,
  instagramFormatado,
  instagramUrl,
  formatarReais,
  progressoMeta,
  rotuloCategoriaMeta,
  rotuloStatusMeta,
  rotuloCategoriaEvento,
  rotuloStatusEvento,
  formatarHora,
} from "./src/lib/redeSocial.ts";
import {
  rotuloTipoEvento,
  textoApoioEvento,
  chaveMetaCriada,
  chaveContribuicao,
  chaveMetaAtingida,
  EVENTOS_IMPORTANTES,
} from "./src/lib/feed.ts";

let falhas = 0;
let total = 0;
function ok(nome: string, cond: boolean) {
  total++;
  if (!cond) {
    falhas++;
    console.error(`[FALHOU] ${nome}`);
  } else {
    console.log(`[OK] ${nome}`);
  }
}

// ---------- Instagram ----------
ok("normaliza remove @", normalizaInstagram("@Thiago_Pedriz") === "thiago_pedriz");
ok("normaliza remove espaços", normalizaInstagram("  Thiago  Pedriz ") === "thiagopedriz");
ok("normaliza remove caracteres inválidos", normalizaInstagram("Thiago!@#") === "thiago");
ok(
  "normaliza mantém pontos e underscore",
  normalizaInstagram("thiago.pedriz_01") === "thiago.pedriz_01",
);
ok("instagramFormatado nulo -> null", instagramFormatado(null) === null);
ok("instagramFormatado vazio -> null", instagramFormatado("   ") === null);
ok("instagramFormatado monta @", instagramFormatado("thiagopedriz") === "@thiagopedriz");
ok(
  "instagramUrl monta link",
  instagramUrl("thiagopedriz") === "https://instagram.com/thiagopedriz",
);
ok("instagramUrl nulo -> null", instagramUrl(null) === null);

// ---------- Moeda / metas ----------
const NBSP = "\u00A0"; // espaço não separável usado pelo toLocaleString pt-BR
ok("formatarReais 1500", formatarReais(1500) === `R$${NBSP}1.500,00`);
ok("formatarReais 920.5", formatarReais(920.5) === `R$${NBSP}920,50`);
ok("formatarReais nulo", formatarReais(null) === `R$${NBSP}0,00`);
const prog = progressoMeta(920, 1500);
ok("progressoMeta percentual", prog.percentual === 61);
ok("progressoMeta restante", prog.restante === 580);
ok("progressoMeta capa em 100", progressoMeta(2000, 1500).percentual === 100);
ok("rotuloCategoriaMeta", rotuloCategoriaMeta("material_esportivo") === "Material esportivo");
ok("rotuloCategoriaMeta fallback", rotuloCategoriaMeta("x") === "Outros");
ok("rotuloStatusMeta", rotuloStatusMeta("atingida") === "Meta atingida!");
ok("rotuloStatusMeta fallback", rotuloStatusMeta(null) === "Ativa");

// ---------- Agenda ----------
ok("rotuloCategoriaEvento", rotuloCategoriaEvento("baba") === "Baba");
ok("rotuloStatusEvento", rotuloStatusEvento("cancelado") === "Cancelado");
ok("formatarHora 20:00:00", formatarHora("20:00:00") === "20:00");
ok("formatarHora vazio", formatarHora(null) === "");

// ---------- Feed: novos tipos de evento (metas) ----------
ok("rotulo META_CRIADA", rotuloTipoEvento("META_CRIADA") === "Nova meta");
ok(
  "rotulo CONTRIBUICAO_CONFIRMADA",
  rotuloTipoEvento("CONTRIBUICAO_CONFIRMADA") === "Contribuição",
);
ok("rotulo META_ATINGIDA", rotuloTipoEvento("META_ATINGIDA") === "Meta atingida!");
ok(
  "textoApoio META_CRIADA com valor_alvo",
  textoApoioEvento({
    tipo: "META_CRIADA",
    descricao: "Nova meta criada",
    metadata: { meta_id: "x", valor_alvo: 1500 },
  }) === "Meta coletiva de R$ 1.500,00",
);
ok(
  "textoApoio CONTRIBUICAO_CONFIRMADA com valor",
  textoApoioEvento({
    tipo: "CONTRIBUICAO_CONFIRMADA",
    descricao: "Contribuiu para a meta",
    metadata: { meta_id: "x", valor: 50 },
  }) === "Contribuiu com R$ 50,00",
);
ok(
  "textoApoio META_ATINGIDA usa descricao",
  textoApoioEvento({
    tipo: "META_ATINGIDA",
    descricao: "Coletes individuais",
    metadata: { meta_id: "x" },
  }) === "Coletes individuais",
);
ok("chaveMetaCriada", chaveMetaCriada("m1") === "meta_criada:m1");
ok("chaveContribuicao", chaveContribuicao("c1") === "contribuicao:c1");
ok("chaveMetaAtingida", chaveMetaAtingida("m1") === "meta_atingida:m1");
ok("EVENTOS_IMPORTANTES inclui META_ATINGIDA", EVENTOS_IMPORTANTES.has("META_ATINGIDA" as never));

console.log(`\n${total - falhas}/${total} testes passaram`);
if (falhas > 0) process.exit(1);
