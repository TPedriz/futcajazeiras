-- ============================================================
-- Locais fixos de baba: reutilizáveis ao criar/editar sessões.
-- Ex.: Arena Cajazeiras com coordenadas e raio padrão.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.locais_baba (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  raio_metros integer NOT NULL DEFAULT 1000,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.locais_baba TO authenticated;
GRANT ALL ON public.locais_baba TO service_role;
ALTER TABLE public.locais_baba ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos leem locais" ON public.locais_baba;
CREATE POLICY "Todos leem locais" ON public.locais_baba
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin gerencia locais" ON public.locais_baba;
CREATE POLICY "Admin gerencia locais" ON public.locais_baba
  FOR ALL TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

CREATE TRIGGER locais_baba_atualizado_em
  BEFORE UPDATE ON public.locais_baba
  FOR EACH ROW EXECUTE FUNCTION public.atualiza_atualizado_em();

-- Seed padrão: Arena Cajazeiras
INSERT INTO public.locais_baba (nome, latitude, longitude, raio_metros)
VALUES ('Arena Cajazeiras', -12.898243032071784, -38.39820393037823, 1000)
ON CONFLICT DO NOTHING;
