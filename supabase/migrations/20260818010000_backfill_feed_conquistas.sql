-- ============================================================
-- Fut Cajazeiras — Backfill: conquistas já desbloqueadas no feed
-- ------------------------------------------------------------
-- Rode no SQL editor do Lovable (Supabase). Idempotente (pode rodar de novo).
--
-- Gera eventos no feed para as conquistas que os usuários JÁ possuíam antes
-- da criação do feed social (migration 20260818000000_feed_social.sql).
--
-- Usa EXATAMENTE a mesma lógica e `chave_unica` da `desbloqueia_conquista`
-- (conquista:{usuario}:{conquista} e marca:{usuario}:{conquista}), então:
--   - NUNCA duplica (ON CONFLICT (chave_unica) DO NOTHING);
--   - reexecutar é seguro;
--   - desbloqueios futuros também não duplicam os eventos já gerados aqui.
-- O `criado_em` usa `desbloqueada_em` real para o feed ficar em ordem
-- cronológica natural.
-- ============================================================

-- 1) Conquistas já desbloqueadas -> CONQUISTA_DESBLOQUEADA / CONQUISTA_RARA
--    (raridade rara+ vira CONQUISTA_RARA; as demais, CONQUISTA_DESBLOQUEADA).
--    Conquistas históricas ficam de fora: `concede_conquista_historica` já
--    gera o evento EVENTO_HISTORICO com chave própria.
INSERT INTO public.feed_eventos (tipo, usuario_id, conquista_id, titulo, descricao, metadata, chave_unica, criado_em)
SELECT
  CASE WHEN c.raridade IN ('rara','epica','lendaria','mitica')
       THEN 'CONQUISTA_RARA'
       ELSE 'CONQUISTA_DESBLOQUEADA'
  END,
  uc.usuario_id,
  uc.conquista_id,
  c.nome,
  c.descricao,
  jsonb_build_object('raridade', c.raridade, 'categoria', c.categoria, 'meta', c.meta, 'icone', c.icone),
  'conquista:' || uc.usuario_id::text || ':' || uc.conquista_id::text,
  uc.desbloqueada_em
FROM public.usuario_conquistas uc
JOIN public.conquistas c ON c.id = uc.conquista_id
WHERE c.historica IS FALSE
ON CONFLICT (chave_unica) DO NOTHING;

-- 2) Marcas históricas (meta >= 100 em gols/assistências/presenças)
--    -> MARCA_ATINGIDA (mesma condição da `desbloqueia_conquista`).
INSERT INTO public.feed_eventos (tipo, usuario_id, conquista_id, titulo, descricao, metadata, chave_unica, criado_em)
SELECT
  'MARCA_ATINGIDA',
  uc.usuario_id,
  uc.conquista_id,
  c.nome || ' — marca atingida',
  'Marca alcançada: ' || c.meta || ' na categoria ' || c.categoria || '.',
  jsonb_build_object('categoria', c.categoria, 'meta', c.meta, 'icone', c.icone),
  'marca:' || uc.usuario_id::text || ':' || uc.conquista_id::text,
  uc.desbloqueada_em
FROM public.usuario_conquistas uc
JOIN public.conquistas c ON c.id = uc.conquista_id
WHERE c.historica IS FALSE
  AND c.meta >= 100
  AND c.categoria IN ('gols','assistencias','presenca')
ON CONFLICT (chave_unica) DO NOTHING;
