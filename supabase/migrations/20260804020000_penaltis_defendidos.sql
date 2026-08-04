-- Pênaltis defendidos nas estatísticas (qualquer jogador pode ir pro gol).
ALTER TABLE public.estatisticas_baba
  ADD COLUMN IF NOT EXISTS penaltis_defendidos integer NOT NULL DEFAULT 0;

-- Ranking mensal: inclui pênaltis defendidos.
-- A view mantém todos os lançamentos (inclusive quem só tem cartões); o filtro
-- por categoria (ex.: só quem tem gols > 0) é feito na exibição, para que a
-- categoria "Cartões" continue funcionando sem contaminar as demais.
DROP VIEW IF EXISTS public.ranking_mensal;
CREATE VIEW public.ranking_mensal WITH (security_invoker = true) AS
WITH gols AS (
  SELECT (date_trunc('month', s.data_horario))::date AS mes,
         e.usuario_id,
         (sum(e.gols))::integer AS gols,
         (sum(e.assistencias))::integer AS assistencias,
         (sum(e.penaltis_defendidos))::integer AS penaltis_defendidos,
         (sum(e.cartoes_amarelos))::integer AS cartoes_amarelos,
         (sum(e.cartoes_azuis))::integer AS cartoes_azuis,
         (sum(e.cartoes_vermelhos))::integer AS cartoes_vermelhos
  FROM public.estatisticas_baba e
  JOIN public.sessoes_baba s ON s.id = e.baba_id
  GROUP BY 1, 2
), resultados AS (
  SELECT (date_trunc('month', s.data_horario))::date AS mes,
         tj.usuario_id,
         (count(*) FILTER (WHERE t.resultado = 'vitoria'))::integer AS vitorias,
         (count(*) FILTER (WHERE t.resultado = 'derrota'))::integer AS derrotas,
         (count(*) FILTER (WHERE t.resultado = 'empate'))::integer AS empates
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
       COALESCE(g.assistencias, 0) AS assistencias,
       COALESCE(g.penaltis_defendidos, 0) AS penaltis_defendidos,
       COALESCE(g.cartoes_amarelos, 0) AS cartoes_amarelos,
       COALESCE(g.cartoes_azuis, 0) AS cartoes_azuis,
       COALESCE(g.cartoes_vermelhos, 0) AS cartoes_vermelhos,
       COALESCE(r.vitorias, 0) AS vitorias,
       COALESCE(r.derrotas, 0) AS derrotas,
       COALESCE(r.empates, 0) AS empates
FROM gols g
FULL JOIN resultados r ON r.mes = g.mes AND r.usuario_id = g.usuario_id
JOIN public.perfis_publicos p ON p.id = COALESCE(g.usuario_id, r.usuario_id);

GRANT SELECT ON public.ranking_mensal TO authenticated;
