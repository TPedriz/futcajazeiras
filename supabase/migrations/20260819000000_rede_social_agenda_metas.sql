-- ============================================================================
-- Fut Cajazeiras — REDE SOCIAL + AGENDA + METAS (2026-08-19)
-- Rode no SQL editor do Lovable (Supabase). Idempotente (pode rodar de novo).
--
-- Conteúdo:
--   1. Instagram no perfil (perfis + perfis_publicos + trigger de sync)
--   2. Curtidas no feed (feed_likes + RPC alternar_like_feed + Realtime)
--   3. Agenda pública da Arena (arena_eventos + RLS público/admin)
--   4. Metas coletivas (metas + contribuicoes_meta + pagamento PIX)
--   5. Eventos do feed p/ metas (META_CRIADA / CONTRIBUICAO_CONFIRMADA / META_ATINGIDA)
-- ============================================================================

-- ============================================================================
-- 1. INSTAGRAM NO PERFIL
-- ============================================================================

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS instagram text;

COMMENT ON COLUMN public.perfis.instagram IS
  '@Instagram do jogador (normalizado, sem @), opcional e público.';

-- espelha no perfil público (a tabela `perfis_publicos` é a fonte pública)
ALTER TABLE public.perfis_publicos
  ADD COLUMN IF NOT EXISTS instagram text;

-- Nível e XP são públicos no perfil (ranking social), então entram na tabela pública.
ALTER TABLE public.perfis_publicos
  ADD COLUMN IF NOT EXISTS nivel_atual integer NOT NULL DEFAULT 1;

ALTER TABLE public.perfis_publicos
  ADD COLUMN IF NOT EXISTS xp_atual integer NOT NULL DEFAULT 0;

-- Atualiza a função de sincronização para incluir o instagram, nível e XP.
CREATE OR REPLACE FUNCTION public.sincroniza_perfil_publico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfis_publicos (id, nome, posicao, ativo, time_coracao, avatar_url, instagram, nivel_atual, xp_atual)
  VALUES (NEW.id, NEW.nome, NEW.posicao, NEW.ativo, NEW.time_coracao, NEW.avatar_url, NEW.instagram, NEW.nivel_atual, NEW.xp_atual)
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    posicao = EXCLUDED.posicao,
    ativo = EXCLUDED.ativo,
    time_coracao = EXCLUDED.time_coracao,
    avatar_url = EXCLUDED.avatar_url,
    instagram = EXCLUDED.instagram,
    nivel_atual = EXCLUDED.nivel_atual,
    xp_atual = EXCLUDED.xp_atual;
  RETURN NEW;
END;
$$;

-- Recria o trigger com a lista de colunas incluindo instagram, nivel e xp.
DROP TRIGGER IF EXISTS trg_sincroniza_perfil_publico ON public.perfis;
CREATE TRIGGER trg_sincroniza_perfil_publico
AFTER INSERT OR UPDATE OF nome, posicao, ativo, time_coracao, avatar_url, instagram, nivel_atual, xp_atual
ON public.perfis
FOR EACH ROW
EXECUTE FUNCTION public.sincroniza_perfil_publico();

-- Backfill: copia instagram / nível / xp já existentes para a tabela pública.
UPDATE public.perfis_publicos pp
SET instagram = p.instagram,
    nivel_atual = p.nivel_atual,
    xp_atual = p.xp_atual
FROM public.perfis p
WHERE p.id = pp.id
  AND (pp.instagram IS DISTINCT FROM p.instagram
       OR pp.nivel_atual IS DISTINCT FROM p.nivel_atual
       OR pp.xp_atual IS DISTINCT FROM p.xp_atual);

GRANT SELECT (id, nome, posicao, ativo, time_coracao, avatar_url, instagram, nivel_atual, xp_atual)
  ON public.perfis_publicos TO authenticated;

-- ============================================================================
-- 2. CURTIDAS NO FEED
-- ============================================================================

-- Instagram também entra na view pública de cartinhas (para mostrar no card).
CREATE OR REPLACE VIEW public.ranking_cartinhas AS
SELECT id, nome, avatar_url, posicao, ovr,
       stat_ritmo, stat_finalizacao, stat_passe, stat_drible, stat_defesa, stat_fisico,
       tema_carta, instagram, nivel_atual
FROM public.perfis
WHERE ativo = true;

GRANT SELECT ON public.ranking_cartinhas TO authenticated;

CREATE TABLE IF NOT EXISTS public.feed_likes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feed_evento_id uuid NOT NULL REFERENCES public.feed_eventos(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  -- 1 curtida por usuário por publicação (idempotência por constraint)
  CONSTRAINT feed_likes_unico UNIQUE (user_id, feed_evento_id)
);

CREATE INDEX IF NOT EXISTS idx_feed_likes_evento ON public.feed_likes (feed_evento_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_feed_likes_usuario ON public.feed_likes (user_id, criado_em DESC);

ALTER TABLE public.feed_likes ENABLE ROW LEVEL SECURITY;

-- Todos os autenticados leem as curtidas (contador + lista de quem curtiu).
DROP POLICY IF EXISTS "Autenticados leem curtidas do feed" ON public.feed_likes;
CREATE POLICY "Autenticados leem curtidas do feed" ON public.feed_likes
  FOR SELECT TO authenticated USING (true);

-- (INSERT/DELETE acontecem via RPC `alternar_like_feed` — nada de escrita direta.)

GRANT SELECT ON public.feed_likes TO authenticated;
GRANT ALL ON public.feed_likes TO service_role;

-- Realtime: contador atualiza sem recarregar a página.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_likes;
  END IF;
END $$;

-- Alterna a curtida do usuário atual em uma publicação do feed.
-- Retorna true se curtiu, false se descurtiu.
CREATE OR REPLACE FUNCTION public.alternar_like_feed(p_feed_evento_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_existe uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- só permite curtir eventos visíveis
  IF NOT EXISTS (
    SELECT 1 FROM public.feed_eventos
    WHERE id = p_feed_evento_id AND visibilidade = 'VISIVEL'
  ) THEN
    RAISE EXCEPTION 'Publicação não encontrada';
  END IF;

  SELECT id INTO v_existe
  FROM public.feed_likes
  WHERE feed_evento_id = p_feed_evento_id AND user_id = v_user_id
  LIMIT 1;

  IF v_existe IS NOT NULL THEN
    DELETE FROM public.feed_likes WHERE id = v_existe;
    RETURN false;
  END IF;

  INSERT INTO public.feed_likes (feed_evento_id, user_id)
  VALUES (p_feed_evento_id, v_user_id);
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.alternar_like_feed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.alternar_like_feed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.alternar_like_feed(uuid) TO service_role;

-- ============================================================================
-- 3. AGENDA PÚBLICA DA ARENA (arena_eventos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.arena_eventos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo        text NOT NULL,
  data_evento   date NOT NULL,
  hora_inicio   time NOT NULL,
  hora_fim      time,
  organizador   text NOT NULL DEFAULT 'Fut Cajazeiras',
  descricao     text NOT NULL DEFAULT '',
  categoria     text NOT NULL DEFAULT 'baba',       -- baba | evento | outro
  status        text NOT NULL DEFAULT 'agendado',   -- agendado | cancelado | concluido
  local         text NOT NULL DEFAULT 'Arena Cajazeiras',
  vagas         integer CHECK (vagas IS NULL OR vagas > 0),
  criado_por    uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arena_eventos_data ON public.arena_eventos (data_evento, hora_inicio);
CREATE INDEX IF NOT EXISTS idx_arena_eventos_status ON public.arena_eventos (status);

ALTER TABLE public.arena_eventos ENABLE ROW LEVEL SECURITY;

-- Público (inclusive anônimo na landing): lê os eventos da agenda.
DROP POLICY IF EXISTS "Publico le eventos da arena" ON public.arena_eventos;
CREATE POLICY "Publico le eventos da arena" ON public.arena_eventos
  FOR SELECT TO anon, authenticated USING (true);

-- Diretoria gerencia (criar/editar/excluir/cancelar).
DROP POLICY IF EXISTS "Admin gerencia eventos da arena" ON public.arena_eventos;
CREATE POLICY "Admin gerencia eventos da arena" ON public.arena_eventos
  FOR ALL TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

GRANT SELECT ON public.arena_eventos TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.arena_eventos TO authenticated;
GRANT ALL ON public.arena_eventos TO service_role;

-- ============================================================================
-- 4. METAS COLETIVAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.metas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text NOT NULL,
  descricao       text NOT NULL DEFAULT '',
  imagem_url      text,
  valor_alvo      numeric(10,2) NOT NULL CHECK (valor_alvo > 0),
  valor_arrecadado numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor_arrecadado >= 0),
  prazo           date,
  status          text NOT NULL DEFAULT 'ativa',    -- ativa | encerrada | atingida
  categoria       text NOT NULL DEFAULT 'outros',   -- material_esportivo | eventos | resenha | infraestrutura | uniforme | outros
  criado_por      uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metas_status ON public.metas (status, criado_em DESC);

ALTER TABLE public.metas ENABLE ROW LEVEL SECURITY;

-- Todos os autenticados leem as metas (arrecadação coletiva pública).
DROP POLICY IF EXISTS "Autenticados leem metas" ON public.metas;
CREATE POLICY "Autenticados leem metas" ON public.metas
  FOR SELECT TO authenticated USING (true);

-- Diretoria gerencia metas.
DROP POLICY IF EXISTS "Admin gerencia metas" ON public.metas;
CREATE POLICY "Admin gerencia metas" ON public.metas
  FOR ALL TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

GRANT SELECT ON public.metas TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.metas TO authenticated;
GRANT ALL ON public.metas TO service_role;

-- Contribuições (dados públicos; dados sensíveis de PIX ficam em tabela separada).
CREATE TABLE IF NOT EXISTS public.contribuicoes_meta (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id         uuid NOT NULL REFERENCES public.metas(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  valor           numeric(10,2) NOT NULL CHECK (valor > 0),
  anonima         boolean NOT NULL DEFAULT false,
  status          text NOT NULL DEFAULT 'pendente',  -- pendente | confirmada | rejeitada
  criado_em       timestamptz NOT NULL DEFAULT now(),
  confirmada_em   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_contribuicoes_meta_meta ON public.contribuicoes_meta (meta_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_contribuicoes_meta_user ON public.contribuicoes_meta (user_id, criado_em DESC);

ALTER TABLE public.contribuicoes_meta ENABLE ROW LEVEL SECURITY;

-- Todos os autenticados leem as contribuições (histórico público respeitando anonimato).
DROP POLICY IF EXISTS "Autenticados leem contribuicoes" ON public.contribuicoes_meta;
CREATE POLICY "Autenticados leem contribuicoes" ON public.contribuicoes_meta
  FOR SELECT TO authenticated USING (true);

-- O usuário inicia a própria contribuição (status pendente; confirmação só via pagamento).
DROP POLICY IF EXISTS "Usuario inicia propria contribuicao" ON public.contribuicoes_meta;
CREATE POLICY "Usuario inicia propria contribuicao" ON public.contribuicoes_meta
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pendente');

-- Diretoria pode rejeitar/excluir contribuições.
DROP POLICY IF EXISTS "Admin gere contribuicoes" ON public.contribuicoes_meta;
CREATE POLICY "Admin gere contribuicoes" ON public.contribuicoes_meta
  FOR UPDATE, DELETE TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

GRANT SELECT, INSERT ON public.contribuicoes_meta TO authenticated;
GRANT UPDATE, DELETE ON public.contribuicoes_meta TO authenticated;
GRANT ALL ON public.contribuicoes_meta TO service_role;

-- Dados sensíveis do PIX de cada contribuição (padrão `presencas_pagamento`).
CREATE TABLE IF NOT EXISTS public.contribuicoes_meta_pagamento (
  contribuicao_id uuid PRIMARY KEY REFERENCES public.contribuicoes_meta(id) ON DELETE CASCADE,
  mp_payment_id   text,
  pix_qr_code     text,
  pix_qr_base64   text,
  pix_expira_em   timestamptz,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contribuicoes_meta_pagamento ENABLE ROW LEVEL SECURITY;

-- Somente o dono da contribuição lê o próprio PIX; admin lê todos.
DROP POLICY IF EXISTS "Dono le pagamento da contribuicao" ON public.contribuicoes_meta_pagamento;
CREATE POLICY "Dono le pagamento da contribuicao" ON public.contribuicoes_meta_pagamento
  FOR SELECT TO authenticated
  USING (
    public.tem_papel(auth.uid(), 'administrador')
    OR EXISTS (
      SELECT 1 FROM public.contribuicoes_meta cm
      WHERE cm.id = contribuicao_id AND cm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admin le todos pagamentos de contribuicao" ON public.contribuicoes_meta_pagamento;
CREATE POLICY "Admin le todos pagamentos de contribuicao" ON public.contribuicoes_meta_pagamento
  FOR SELECT TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'));

GRANT SELECT ON public.contribuicoes_meta_pagamento TO authenticated;
GRANT ALL ON public.contribuicoes_meta_pagamento TO service_role;

-- ============================================================================
-- 5. EVENTOS DO FEED PARA METAS
--    Tipos novos: META_CRIADA | CONTRIBUICAO_CONFIRMADA | META_ATINGIDA
-- ============================================================================

-- View eficiente: total de conquistas por usuário (evita N+1 em listas sociais).
CREATE OR REPLACE VIEW public.total_conquistas_usuario
WITH (security_invoker = true) AS
SELECT usuario_id, count(*)::integer AS total
FROM public.usuario_conquistas
GROUP BY usuario_id;

GRANT SELECT ON public.total_conquistas_usuario TO authenticated;

-- View eficiente: total de jogadores por conquista ("N jogadores conquistaram").
CREATE OR REPLACE VIEW public.total_conquistadores
WITH (security_invoker = true) AS
SELECT conquista_id, count(*)::integer AS total
FROM public.usuario_conquistas
GROUP BY conquista_id;

GRANT SELECT ON public.total_conquistadores TO authenticated;

-- Cria uma meta (diretoria) e emite o evento de feed "Nova meta criada!".
CREATE OR REPLACE FUNCTION public.criar_meta_admin(
  p_titulo text,
  p_descricao text DEFAULT '',
  p_imagem_url text DEFAULT NULL,
  p_valor_alvo numeric,
  p_prazo date DEFAULT NULL,
  p_categoria text DEFAULT 'outros'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta_id uuid;
  v_admin uuid := auth.uid();
BEGIN
  IF NOT public.tem_papel(v_admin, 'administrador') THEN
    RAISE EXCEPTION 'Somente a diretoria pode criar metas';
  END IF;
  IF p_valor_alvo IS NULL OR p_valor_alvo <= 0 THEN
    RAISE EXCEPTION 'Valor alvo inválido';
  END IF;

  INSERT INTO public.metas (titulo, descricao, imagem_url, valor_alvo, prazo, categoria, criado_por)
  VALUES (p_titulo, p_descricao, p_imagem_url, p_valor_alvo, p_prazo, p_categoria, v_admin)
  RETURNING id INTO v_meta_id;

  -- 🎯 Nova meta criada! (idempotente por chave)
  PERFORM public.cria_evento_feed(
    'META_CRIADA',
    v_admin,
    NULL,
    p_titulo,
    'Nova meta criada',
    jsonb_build_object('meta_id', v_meta_id, 'categoria', p_categoria, 'valor_alvo', p_valor_alvo),
    'meta_criada:' || v_meta_id
  );

  RETURN v_meta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_meta_admin(text, text, text, numeric, date, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.criar_meta_admin(text, text, text, numeric, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.criar_meta_admin(text, text, text, numeric, date, text) TO service_role;

-- Atualiza uma meta (diretoria) e emite eventos de feed quando o status muda.
CREATE OR REPLACE FUNCTION public.atualizar_meta_admin(
  p_meta_id uuid,
  p_titulo text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_imagem_url text DEFAULT NULL,
  p_valor_alvo numeric DEFAULT NULL,
  p_prazo date DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_status_anterior text;
  v_novo_status text;
  v_titulo text;
BEGIN
  IF NOT public.tem_papel(v_admin, 'administrador') THEN
    RAISE EXCEPTION 'Somente a diretoria pode editar metas';
  END IF;

  SELECT status, titulo INTO v_status_anterior, v_titulo
  FROM public.metas WHERE id = p_meta_id FOR UPDATE;
  IF v_status_anterior IS NULL THEN
    RAISE EXCEPTION 'Meta não encontrada';
  END IF;

  UPDATE public.metas SET
    titulo        = COALESCE(p_titulo, titulo),
    descricao     = COALESCE(p_descricao, descricao),
    imagem_url    = COALESCE(p_imagem_url, imagem_url),
    valor_alvo    = COALESCE(p_valor_alvo, valor_alvo),
    prazo         = COALESCE(p_prazo, prazo),
    categoria     = COALESCE(p_categoria, categoria),
    status        = COALESCE(p_status, status),
    atualizado_em = now()
  WHERE id = p_meta_id;

  v_novo_status := COALESCE(p_status, v_status_anterior);

  -- 🎉 META ATINGIDA! (somente quando muda para atingida)
  IF v_novo_status = 'atingida' AND v_status_anterior <> 'atingida' THEN
    PERFORM public.cria_evento_feed(
      'META_ATINGIDA',
      v_admin,
      NULL,
      'Meta atingida!',
      v_titulo,
      jsonb_build_object('meta_id', p_meta_id),
      'meta_atingida:' || p_meta_id
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.atualizar_meta_admin(uuid, text, text, text, numeric, date, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.atualizar_meta_admin(uuid, text, text, text, numeric, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.atualizar_meta_admin(uuid, text, text, text, numeric, date, text, text) TO service_role;

-- Confirma uma contribuição paga (chamada pelo servidor via service_role)
-- e emite os eventos de feed correspondentes.
CREATE OR REPLACE FUNCTION public.confirmar_contribuicao_meta(p_contribuicao_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta_id uuid;
  v_valor numeric;
  v_user_id uuid;
  v_anonima boolean;
  v_meta_titulo text;
  v_valor_alvo numeric;
  v_arrecadado numeric;
  v_status text;
BEGIN
  SELECT meta_id, valor, user_id, anonima, status
    INTO v_meta_id, v_valor, v_user_id, v_anonima, v_status
  FROM public.contribuicoes_meta WHERE id = p_contribuicao_id FOR UPDATE;
  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Contribuição não encontrada';
  END IF;
  IF v_status = 'confirmada' THEN
    RETURN; -- idempotente
  END IF;

  UPDATE public.contribuicoes_meta
  SET status = 'confirmada', confirmada_em = now()
  WHERE id = p_contribuicao_id;

  -- Atualiza o valor arrecadado da meta.
  UPDATE public.metas
  SET valor_arrecadado = valor_arrecadado + v_valor,
      atualizado_em = now()
  WHERE id = v_meta_id
  RETURNING titulo, valor_alvo, valor_arrecadado, status
    INTO v_meta_titulo, v_valor_alvo, v_arrecadado, v_status;

  -- 💰 Contribuição confirmada (respeitando anonimato).
  IF NOT v_anonima THEN
    PERFORM public.cria_evento_feed(
      'CONTRIBUICAO_CONFIRMADA',
      v_user_id,
      NULL,
      'Contribuição confirmada',
      'Contribuiu para a meta "' || v_meta_titulo || '"',
      jsonb_build_object('meta_id', v_meta_id, 'valor', v_valor),
      'contribuicao:' || p_contribuicao_id
    );
  END IF;

  -- 🎉 META ATINGIDA quando a meta zera/ultrapassa o alvo.
  IF v_status <> 'atingida' AND v_arrecadado >= v_valor_alvo THEN
    UPDATE public.metas SET status = 'atingida', atualizado_em = now() WHERE id = v_meta_id;
    PERFORM public.cria_evento_feed(
      'META_ATINGIDA',
      v_user_id,
      NULL,
      'Meta atingida!',
      v_meta_titulo,
      jsonb_build_object('meta_id', v_meta_id, 'valor_alvo', v_valor_alvo),
      'meta_atingida:' || v_meta_id
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_contribuicao_meta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirmar_contribuicao_meta(uuid) TO service_role;
