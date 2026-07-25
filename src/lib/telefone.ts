// Utilitários para tratar telefone (WhatsApp) como identificador de login.
// Não usamos SMS: convertemos o telefone em um "e-mail sintético" só para o Supabase Auth.

export function apenasDigitos(valor: string): string {
  return (valor ?? "").replace(/\D+/g, "");
}

export function telefoneValido(valor: string): boolean {
  const d = apenasDigitos(valor);
  // 10 (fixo) ou 11 (celular) dígitos com DDD. Aceita também com 55 na frente.
  if (d.length === 10 || d.length === 11) return true;
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return true;
  return false;
}

export function normalizaTelefone(valor: string): string {
  let d = apenasDigitos(valor);
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) {
    d = d.slice(2);
  }
  return d;
}

export function telefoneParaEmail(valor: string): string {
  const d = normalizaTelefone(valor);
  return `${d}@wa.futcajazeiras.local`;
}

export function formataTelefone(valor: string): string {
  const d = normalizaTelefone(valor).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}
