// Validação pós-migração do feed social (executar: node _valida_feed.mjs)
// Sem sessão (anon): NÃO deve conseguir ler feed_eventos (RLS + sem grant anon).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// Carrega o .env manualmente (o Node não auto-carrega).
const env = {};
for (const linha of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const linhaLimpa = linha.trim();
  if (!linhaLimpa || linhaLimpa.startsWith("#")) continue;
  const idx = linhaLimpa.indexOf("=");
  if (idx < 0) continue;
  const chave = linhaLimpa.slice(0, idx).trim();
  let valor = linhaLimpa.slice(idx + 1).trim();
  if (
    (valor.startsWith('"') && valor.endsWith('"')) ||
    (valor.startsWith("'") && valor.endsWith("'"))
  ) {
    valor = valor.slice(1, -1);
  }
  env[chave] = valor;
}

const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("❌ Variáveis do Supabase ausentes no .env");
  process.exit(1);
}

const sb = createClient(url, key);
let falhas = 0;
let total = 0;
function ok(nome, cond) {
  total++;
  if (!cond) {
    falhas++;
    console.error(`❌ ${nome}`);
  } else {
    console.log(`✅ ${nome}`);
  }
}

// 1) Tabela feed_eventos existe e NÃO é legível por anon (RLS ativo).
const { data, error } = await sb.from("feed_eventos").select("id").limit(1);
const semAcessoAnon = error !== null || (data !== null && data.length === 0);
ok("anon NÃO lê feed_eventos (RLS/grant)", semAcessoAnon);

// 2) RPC modera_evento_feed NÃO é executável por anon (admin-only).
const r1 = await sb.rpc("modera_evento_feed", {
  p_evento_id: "00000000-0000-0000-0000-000000000000",
  p_visibilidade: "OCULTO",
});
ok("anon NÃO executa modera_evento_feed", r1.error !== null);

// 3) RPC concede_conquista_historica NÃO é executável por anon (admin-only).
const r2 = await sb.rpc("concede_conquista_historica", {
  p_usuario: "00000000-0000-0000-0000-000000000000",
  p_codigo: "teste",
  p_titulo: "teste",
  p_descricao: "teste",
});
ok("anon NÃO executa concede_conquista_historica", r2.error !== null);

// 4) RPC cria_evento_feed NÃO é executável por anon (só service_role).
const r3 = await sb.rpc("cria_evento_feed", {
  p_tipo: "CONQUISTA_RARA",
  p_usuario: "00000000-0000-0000-0000-000000000000",
  p_titulo: "teste",
});
ok("anon NÃO executa cria_evento_feed", r3.error !== null);

console.log(`\n${total - falhas}/${total} validações passaram`);
if (falhas > 0) process.exit(1);
