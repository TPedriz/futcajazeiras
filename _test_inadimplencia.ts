// Testes do motor de inadimplência, multas e coletes genéricos.
// Rode com: node _test_inadimplencia.ts
import {
  estaInadimplente,
  mensalidadeAtrasada,
  normalizaStatusConta,
  parseSituacaoFinanceira,
  rotuloStatusConta,
  totalMensalidade,
} from "./src/lib/financeiro.ts";
import {
  formatarArrecadacaoItemParaWhatsApp,
  itensAteMeta,
  itensRestantes,
  TAMANHO_ITEM_PADRAO,
} from "./src/lib/redeSocial.ts";

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

// ---------- Status da conta ----------
ok("normaliza ATIVO", normalizaStatusConta("ATIVO") === "ATIVO");
ok("normaliza INADIMPLENTE", normalizaStatusConta("INADIMPLENTE") === "INADIMPLENTE");
ok("normaliza nulo -> ATIVO", normalizaStatusConta(null) === "ATIVO");
ok("normaliza desconhecido -> ATIVO", normalizaStatusConta("SUSPENSO_X") === "ATIVO");
ok("estaInadimplente true", estaInadimplente("INADIMPLENTE") === true);
ok("estaInadimplente false", estaInadimplente("ATIVO") === false);
ok("rótulo ATIVO", rotuloStatusConta("ATIVO") === "Ativo");
ok("rótulo INADIMPLENTE", rotuloStatusConta("INADIMPLENTE") === "Inadimplente");

// ---------- Multa / total ----------
ok("totalMensalidade 20 + 5", totalMensalidade(20, 5) === 25);
ok("totalMensalidade strings", totalMensalidade("20.50", "5") === 25.5);
ok("totalMensalidade sem multa", totalMensalidade(15, 0) === 15);
ok("mensalidadeAtrasada vencida", mensalidadeAtrasada("2000-01-01", false) === true);
ok("mensalidadeAtrasada paga", mensalidadeAtrasada("2000-01-01", true) === false);
ok("mensalidadeAtrasada sem vencimento", mensalidadeAtrasada(null, false) === false);

// ---------- JSONB do banco ----------
const situacao = parseSituacaoFinanceira({
  usuarioId: "u1",
  statusConta: "INADIMPLENTE",
  ehDiretoria: false,
  mensalidades: [
    {
      mensalidadeId: "m1",
      referencia: "2026-07-01",
      vencimento: "2026-07-31",
      valor: 20,
      multa: 5,
      total: 25,
      atrasada: true,
    },
    {
      mensalidadeId: "m2",
      referencia: "2026-08-01",
      vencimento: "2026-08-31",
      valor: 20,
      multa: 0,
      total: 20,
      atrasada: false,
    },
  ],
  totalDebitos: 45,
  valorMulta: 5,
  taxaAssociacao: 20,
  totalRegularizacao: 65,
});
ok("parse status conta", situacao.statusConta === "INADIMPLENTE");
ok("parse total de débitos", situacao.totalDebitos === 45);
ok("parse total da regularização", situacao.totalRegularizacao === 65);
ok("parse conta atrasadas", situacao.atrasadas === 1);
ok("parse reconstrói total da mensalidade", situacao.mensalidades[1].total === 20);

const vazio = parseSituacaoFinanceira(null);
ok("parse nulo -> vazio", vazio.statusConta === "ATIVO" && vazio.mensalidades.length === 0);
ok("parse nulo -> total zero", vazio.totalRegularizacao === 0);
ok("parse nulo -> automático por padrão", vazio.financeiroAutomatico === true);
ok("parse nulo -> não é associado", vazio.ehAssociado === false);

const manual = parseSituacaoFinanceira({
  statusConta: "INADIMPLENTE",
  ehAssociado: false,
  financeiroAutomatico: false,
  mensalidades: [],
});
ok("parse gestão manual", manual.financeiroAutomatico === false);
ok("parse ex-associado rebaixado", manual.ehAssociado === false);

const tolerante = parseSituacaoFinanceira({ statusConta: "INADIMPLENTE", mensalidades: "x" });
ok("parse tolera payload inválido", tolerante.mensalidades.length === 0);

// ---------- Coletes genéricos ----------
ok("tamanho padrão do item", TAMANHO_ITEM_PADRAO === "Único");
ok("itensAteMeta 1500/71", itensAteMeta(1500, 71) === 21);
ok("itensAteMeta sem alvo", itensAteMeta(null, 71) === 0);
ok("itensAteMeta sem valor item", itensAteMeta(1500, 0) === 0);
ok("itensRestantes 1500/71/355", itensRestantes(1500, 71, 355) === 16);
ok("itensRestantes meta batida", itensRestantes(1500, 71, 1600) === 0);

const textoGenerico = formatarArrecadacaoItemParaWhatsApp(
  {
    titulo: "Coletes genéricos",
    categoria: "material_esportivo",
    valor_item: 71,
    valor_alvo: 1500,
    valor_arrecadado: 213,
    prazo_cadastro: null,
    prazo_pagamento: null,
    exige_personalizacao: false,
  },
  [
    {
      id: "1",
      nome: "Thiago Pedriz",
      nome_camisa: null,
      tamanho: "Único",
      numero_camisa: null,
      status: "confirmada",
    },
  ],
);
ok("whatsapp genérico inclui o tamanho padrão", textoGenerico.includes("(Único)"));
ok("whatsapp genérico lista o pagante", textoGenerico.includes("1. Thiago Pedriz"));
ok("whatsapp genérico não imprime nome de camisa", !textoGenerico.includes('"'));
ok("whatsapp mostra itens até a meta", textoGenerico.includes("Itens até bater a meta: 21"));

console.log(`\n${total - falhas}/${total} testes passaram`);
if (falhas > 0) process.exit(1);
