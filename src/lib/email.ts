// Utilitários de e-mail compartilhados (cliente + servidor — sem dependências server-only).

/** E-mail sintético do Auth usado como login (telefone@wa.futcajazeiras.local). */
export function emailSintetico(email: string | null | undefined): boolean {
  if (!email) return true;
  return /@wa\.futcajazeiras\.local$/i.test(email);
}

/** Identifica o e-mail real de contato (NULL se for sintético ou vazio). */
export function emailReal(email: string | null | undefined): string | null {
  if (!email || emailSintetico(email)) return null;
  return email.trim().toLowerCase();
}
