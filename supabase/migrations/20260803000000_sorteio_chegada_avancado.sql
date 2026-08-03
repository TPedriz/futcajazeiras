-- ============================================================
-- Sorteio "Ordem de Chegada" avançado
-- Marca goleiros como "Fixos": podem cobrir mais de um time no
-- sorteio quando faltam goleiros (round-robin entre times).
-- ============================================================

ALTER TABLE public.presencas
  ADD COLUMN IF NOT EXISTS is_goleiro_fixo boolean NOT NULL DEFAULT false;
