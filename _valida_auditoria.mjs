// Validações estáticas da migration de log de auditoria (não precisa de banco).
// Rode com: node _valida_auditoria.mjs
import { readFileSync } from "node:fs";

const CAMINHO_SQL = "supabase/migrations/20260914000000_log_auditoria.sql";
const sql = readFileSync(CAMINHO_SQL, "utf8");
const tipos = readFileSync("src/integrations/supabase/types.ts", "utf8");

let falhas = 0;
const ok = (nome, cond, extra = "") => {
  if (cond) console.log(`[OK] ${nome}`);
  else {
    falhas++;
    console.error(`[FALHOU] ${nome} ${extra}`);
  }
};

// 1) Blocos de função balanceados
const cifrao = String.fromCharCode(36, 36);
const blocos = sql.split(cifrao).length - 1;
ok(`blocos ${cifrao} balanceados (${blocos})`, blocos % 2 === 0);

// 2) Funções e triggers declarados
const funcoes = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z_]+)\s*\(/g)].map(
  (m) => m[1],
);
ok("funções esperadas criadas", funcoes.length === 5, funcoes.join(", "));

const triggers = [...sql.matchAll(/CREATE TRIGGER ([a-z_]+)/g)].map((m) => m[1]);
ok(`triggers criados (${triggers.length})`, triggers.length === 17, triggers.join(", "));

// 3) Todo trigger aponta para uma tabela existente no schema
const tabelas = [
  ...new Set(
    [...sql.matchAll(/CREATE TRIGGER [a-z_]+ [^;]*?\n?ON public\.([a-z_]+)/gs)].map((m) => m[1]),
  ),
];
for (const tabela of tabelas) {
  const existe = new RegExp(`^      ${tabela}: \\{`, "m").test(tipos);
  ok(`tabela existe no schema: ${tabela}`, existe);
}

// 4) Configs JSON dos triggers são válidas e usam campos conhecidos
const configs = [...sql.matchAll(/log_auditoria_generico\('(\{.*?\})'\)/gs)].map((m) => m[1]);
ok(`configurações JSON encontradas (${configs.length})`, configs.length === triggers.length);
for (const bruto of configs) {
  let cfg;
  try {
    cfg = JSON.parse(bruto);
  } catch (e) {
    falhas++;
    console.error(`[FALHOU] JSON inválido: ${e.message}`);
    continue;
  }
  const obrigatorios = ["acao", "categoria", "descricao"];
  for (const chave of obrigatorios) {
    ok(`config ${cfg.acao || "?"} tem "${chave}"`, typeof cfg[chave] === "string" && !!cfg[chave]);
  }
  const conhecidas = [
    "acao",
    "categoria",
    "descricao",
    "id",
    "nome",
    "alvo",
    "campos",
    "ignorar",
    "contexto",
    "somente_diretoria",
    "notificar_campos",
    "titulo_notificacao",
    "link",
    "ator_padrao",
  ];
  for (const chave of Object.keys(cfg)) {
    ok(`config ${cfg.acao}: chave suportada "${chave}"`, conhecidas.includes(chave));
  }
}

// 5) Colunas de forma de pagamento adicionadas
for (const tabela of ["mensalidades", "presencas", "contribuicoes_meta", "regularizacoes"]) {
  ok(
    `ALTER TABLE ${tabela} ADD metodo_pagamento`,
    new RegExp(`ALTER TABLE public\\.${tabela} ADD COLUMN IF NOT EXISTS metodo_pagamento`).test(
      sql,
    ),
  );
}

console.log(
  falhas === 0
    ? "\nTudo certo: migration consistente (JSONs, triggers e tabelas)."
    : `\n${falhas} problema(s) encontrado(s).`,
);
process.exit(falhas === 0 ? 0 : 1);
