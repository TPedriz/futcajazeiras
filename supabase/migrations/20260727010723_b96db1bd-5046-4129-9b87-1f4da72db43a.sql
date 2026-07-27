-- ============ 1) Segurança: substitui views SECURITY DEFINER ============
DROP VIEW IF EXISTS public.ranking_mensal;
DROP VIEW IF EXISTS public.perfis_publicos;

CREATE TABLE public.perfis_publicos (
  id uuid PRIMARY KEY REFERENCES public.perfis(id) ON DELETE CASCADE,
  nome text NOT NULL,
  posicao public.posicao_jogador NOT NULL DEFAULT 'linha'
);

GRANT SELECT ON public.perfis_publicos TO authenticated;
GRANT ALL ON public.perfis_publicos TO service_role;
ALTER TABLE public.perfis_publicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Associados leem nomes publicos" ON public.perfis_publicos
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.perfis_publicos (id, nome, posicao)
SELECT id, nome, posicao FROM public.perfis
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sincroniza_perfil_publico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfis_publicos (id, nome, posicao)
  VALUES (NEW.id, NEW.nome, NEW.posicao)
  ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, posicao = EXCLUDED.posicao;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sincroniza_perfil_publico() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER perfis_sincroniza_publico
  AFTER INSERT OR UPDATE OF nome, posicao ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.sincroniza_perfil_publico();

CREATE VIEW public.ranking_mensal WITH (security_invoker = true) AS
WITH gols AS (
  SELECT date_trunc('month', s.data_horario)::date AS mes,
         e.usuario_id,
         SUM(e.gols)::int AS gols,
         SUM(e.cartoes_amarelos)::int AS cartoes_amarelos,
         SUM(e.cartoes_azuis)::int AS cartoes_azuis,
         SUM(e.cartoes_vermelhos)::int AS cartoes_vermelhos
  FROM public.estatisticas_baba e
  JOIN public.sessoes_baba s ON s.id = e.baba_id
  GROUP BY 1, 2
),
resultados AS (
  SELECT date_trunc('month', s.data_horario)::date AS mes,
         tj.usuario_id,
         COUNT(*) FILTER (WHERE t.resultado = 'vitoria')::int AS vitorias,
         COUNT(*) FILTER (WHERE t.resultado = 'derrota')::int AS derrotas,
         COUNT(*) FILTER (WHERE t.resultado = 'empate')::int AS empates
  FROM public.times_jogadores tj
  JOIN public.times_baba t ON t.id = tj.time_id
  JOIN public.sessoes_baba s ON s.id = t.baba_id
  WHERE tj.usuario_id IS NOT NULL
  GROUP BY 1, 2
)
SELECT COALESCE(g.mes, r.mes) AS mes,
       COALESCE(g.usuario_id, r.usuario_id) AS usuario_id,
       p.nome,
       p.posicao,
       COALESCE(g.gols, 0) AS gols,
       COALESCE(g.cartoes_amarelos, 0) AS cartoes_amarelos,
       COALESCE(g.cartoes_azuis, 0) AS cartoes_azuis,
       COALESCE(g.cartoes_vermelhos, 0) AS cartoes_vermelhos,
       COALESCE(r.vitorias, 0) AS vitorias,
       COALESCE(r.derrotas, 0) AS derrotas,
       COALESCE(r.empates, 0) AS empates
FROM gols g
FULL OUTER JOIN resultados r ON r.mes = g.mes AND r.usuario_id = g.usuario_id
JOIN public.perfis_publicos p ON p.id = COALESCE(g.usuario_id, r.usuario_id);

GRANT SELECT ON public.ranking_mensal TO authenticated;

-- ============ 2) Pagamentos PIX ============
ALTER TABLE public.mensalidades
  ALTER COLUMN valor SET DEFAULT 15,
  ADD COLUMN mp_payment_id text,
  ADD COLUMN mp_status text,
  ADD COLUMN pix_qr_code text,
  ADD COLUMN pix_qr_base64 text,
  ADD COLUMN pix_expira_em timestamptz;

UPDATE public.mensalidades SET valor = 15 WHERE valor = 0;

CREATE INDEX mensalidades_mp_payment_id_idx ON public.mensalidades (mp_payment_id);

ALTER TABLE public.presencas
  ADD COLUMN valor numeric NOT NULL DEFAULT 0,
  ADD COLUMN mp_payment_id text,
  ADD COLUMN mp_status text,
  ADD COLUMN pix_qr_code text,
  ADD COLUMN pix_qr_base64 text,
  ADD COLUMN pix_expira_em timestamptz;

CREATE INDEX presencas_mp_payment_id_idx ON public.presencas (mp_payment_id);