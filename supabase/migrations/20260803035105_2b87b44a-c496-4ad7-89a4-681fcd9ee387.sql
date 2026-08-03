ALTER TABLE public.presencas
  ADD COLUMN IF NOT EXISTS is_goleiro_fixo boolean NOT NULL DEFAULT false;