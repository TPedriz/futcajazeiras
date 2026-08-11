-- ============================================================
-- Fut Cajazeiras — Tipo de baba (Comum / BAxVI)
-- ------------------------------------------------------------
-- Rode no SQL editor do Lovable (Supabase). Idempotente.
--
-- Adiciona a coluna `tipo` em public.sessoes_baba:
--   'comum' = baba normal (padrão)
--   'baxvi' = Bahia × Vitória (sorteio automático pelo time do coração)
-- ============================================================

ALTER TABLE public.sessoes_baba
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'comum';
