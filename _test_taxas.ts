// Testes das taxas por forma de pagamento (PIX, débito e crédito).
// Rode com: node _test_taxas.ts
import {
  CHAVES_TAXA,
  METODOS_PAGAMENTO,
  TAXAS_PADRAO,
  arredondarCentavos,
  calcularCobranca,
  calcularTaxa,
  metodosComTaxa,
} from "./src/lib/taxasPagamento.ts";

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

const perto = (a: number, b: number) => Math.abs(a - b) < 1e-9;

// ---------- Arredondamento da taxa ----------
ok("taxa 4,99% de 20 => 1,00 (arredonda p/ cima)", perto(calcularTaxa(20, 4.99), 1));
ok("taxa 1,99% de 20 => 0,40 (arredonda p/ cima)", perto(calcularTaxa(20, 1.99), 0.4));
ok("taxa 0% => 0", calcularTaxa(20, 0) === 0);
ok("taxa negativa => 0", calcularTaxa(20, -1) === 0);
ok("taxa de 20% de 1,00 => 0,20 (não empurra p/ 0,21)", perto(calcularTaxa(1, 20), 0.2));
ok("taxa 0,5% de 200 => 1,00 exato", perto(calcularTaxa(200, 0.5), 1));
ok("taxa 13,7% de 7,30 => 1,01", perto(calcularTaxa(7.3, 13.7), 1.01));

// ---------- Cobrança completa ----------
const mensalidade = calcularCobranca(20, TAXAS_PADRAO.credito);
ok("crédito: base 20", perto(mensalidade.valorBase, 20));
ok("crédito: taxa 1,00", perto(mensalidade.taxa, 1));
ok("crédito: total 21,00", perto(mensalidade.total, 21));

const pix = calcularCobranca(20, TAXAS_PADRAO.pix);
ok("PIX: sem taxa", perto(pix.taxa, 0) && perto(pix.total, 20));

const debito = calcularCobranca(20, TAXAS_PADRAO.debito);
ok("débito: total 20,40", perto(debito.total, 20.4));

const comMulta = calcularCobranca(25, TAXAS_PADRAO.credito);
ok("multa entra na base: 25 + 1,25 = 26,25", perto(comMulta.total, 26.25));

// Nunca cobra a menos do que o valor base.
for (const base of [5, 7.3, 15, 20, 33.33, 100]) {
  for (const percentual of [0, 0.99, 1.99, 4.99, 9.99]) {
    const c = calcularCobranca(base, percentual);
    ok(
      `líquido >= base (${base} @ ${percentual}%)`,
      c.total >= c.valorBase && perto(c.total, c.valorBase + c.taxa),
    );
  }
}

// ---------- Utilitários ----------
ok("arredonda centavos para baixo", perto(arredondarCentavos(20.999), 20.99));
ok("3 métodos", METODOS_PAGAMENTO.length === 3);
ok(
  "chaves das taxas",
  Object.values(CHAVES_TAXA).join(",") === "taxa_pix,taxa_debito,taxa_credito",
);
ok("métodos com taxa", metodosComTaxa(TAXAS_PADRAO, 20).length === 3);

console.log(`\n${total - falhas}/${total} testes passaram.`);
if (falhas > 0) process.exit(1);
