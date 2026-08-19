-- ============================================================================
-- Fut Cajazeiras — METAS: ARRECADAÇÃO POR ITEM (coletes personalizados etc.)
-- Data: 2026-08-19
-- Banco: Supabase / PostgreSQL
--
-- SCRIPT IDEMPOTENTE
-- Pode ser executado novamente sem precisar apagar as tabelas existentes.
--
-- CONTEÚDO
--   1. Metas: tipo de arrecadação (aberta | item) + valor por item + prazos
--   2. Contribuições: campos de personalização (nome/tamanho/número na camisa)
--   3. RPC cadastrar_interesse_item (cadastro com custo fixo por item)
--   4. criar_meta_admin / atualizar_meta_admin estendidos com os novos campos
-- ============================================================================


-- ============================================================================
-- 1. METAS — TIPO DE ARRECADAÇÃO
-- ============================================================================

ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS tipo_arrecadacao text NOT NULL DEFAULT 'aberta';

ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS valor_item numeric(10,2);

ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS prazo_cadastro date;

ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS prazo_pagamento date;

COMMENT ON COLUMN public.metas.tipo_arrecadacao IS
  'aberta = usuário contribui com valor livre; item = custo fixo por item (ex.: colete R$ 71).';

COMMENT ON COLUMN public.metas.valor_item IS
  'Custo fixo por item quando tipo_arrecadacao = item.';

COMMENT ON COLUMN public.metas.prazo_cadastro IS
  'Prazo final para o usuário cadastrar o interesse (item).';

COMMENT ON COLUMN public.metas.prazo_pagamento IS
  'Prazo final para o usuário pagar o item cadastrado.';


-- Constraint do tipo de arrecadação.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'metas_tipo_arrecadacao_check'
  ) THEN
    ALTER TABLE public.metas
      ADD CONSTRAINT metas_tipo_arrecadacao_check
      CHECK (tipo_arrecadacao IN ('aberta', 'item'));
  END IF;
END $$;


-- Item exige valor_item > 0.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'metas_item_exige_valor_check'
  ) THEN
    ALTER TABLE public.metas
      ADD CONSTRAINT metas_item_exige_valor_check
      CHECK (tipo_arrecadacao <> 'item' OR (valor_item IS NOT NULL AND valor_item > 0));
  END IF;
END $$;


-- ============================================================================
-- 2. CONTRIBUIÇÕES — PERSONALIZAÇÃO DO ITEM
-- ============================================================================

ALTER TABLE public.contribuicoes_meta
  ADD COLUMN IF NOT EXISTS nome_camisa text;

ALTER TABLE public.contribuicoes_meta
  ADD COLUMN IF NOT EXISTS tamanho text;

ALTER TABLE public.contribuicoes_meta
  ADD COLUMN IF NOT EXISTS numero_camisa text;

COMMENT ON COLUMN public.contribuicoes_meta.nome_camisa IS
  'Nome impresso na camisa (item).';
COMMENT ON COLUMN public.contribuicoes_meta.tamanho IS
  'Tamanho da camisa (item).';
COMMENT ON COLUMN public.contribuicoes_meta.numero_camisa IS
  'Número do jogador na camisa (item).';


-- ============================================================================
-- 3. RPC — CADASTRAR INTERESSE EM ITEM
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cadastrar_interesse_item(
  p_meta_id uuid,
  p_nome_camisa text,
  p_tamanho text,
  p_numero_camisa text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_meta public.metas%ROWTYPE;
  v_contribuicao_id uuid;
BEGIN

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  SELECT *
  INTO v_meta
  FROM public.metas
  WHERE id = p_meta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meta não encontrada';
  END IF;

  IF v_meta.tipo_arrecadacao <> 'item' THEN
    RAISE EXCEPTION 'Esta meta não é uma arrecadação por item';
  END IF;

  IF v_meta.status <> 'ativa' THEN
    RAISE EXCEPTION 'Esta meta não está mais ativa';
  END IF;

  IF v_meta.prazo_cadastro IS NOT NULL
     AND v_meta.prazo_cadastro < CURRENT_DATE THEN
    RAISE EXCEPTION 'O prazo de cadastro já encerrou';
  END IF;

  IF trim(COALESCE(p_nome_camisa, '')) = ''
     OR trim(COALESCE(p_tamanho, '')) = ''
     OR trim(COALESCE(p_numero_camisa, '')) = '' THEN
    RAISE EXCEPTION 'Preencha nome, tamanho e número da camisa';
  END IF;

  -- O usuário não pode se cadastrar duas vezes (pendente ou confirmado).
  IF EXISTS (
    SELECT 1 FROM public.contribuicoes_meta
    WHERE meta_id = p_meta_id
      AND user_id = v_user_id
      AND status IN ('pendente', 'confirmada')
  ) THEN
    RAISE EXCEPTION 'Você já está cadastrado nesta meta';
  END IF;

  INSERT INTO public.contribuicoes_meta (
    meta_id,
    user_id,
    valor,
    anonima,
    status,
    nome_camisa,
    tamanho,
    numero_camisa
  )
  VALUES (
    p_meta_id,
    v_user_id,
    v_meta.valor_item,
    false,
    'pendente',
    trim(p_nome_camisa),
    trim(p_tamanho),
    trim(p_numero_camisa)
  )
  RETURNING id
  INTO v_contribuicao_id;

  RETURN v_contribuicao_id;

END;
$$;


REVOKE ALL
ON FUNCTION public.cadastrar_interesse_item(uuid, text, text, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.cadastrar_interesse_item(uuid, text, text, text)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.cadastrar_interesse_item(uuid, text, text, text)
TO service_role;


-- ============================================================================
-- 4. CRIAR META — ADMIN (ESTENDIDO)
-- ============================================================================

DROP FUNCTION IF EXISTS public.criar_meta_admin(text, text, text, numeric, date, text);

CREATE OR REPLACE FUNCTION public.criar_meta_admin(
  p_titulo text,
  p_descricao text DEFAULT '',
  p_imagem_url text DEFAULT NULL,
  p_valor_alvo numeric DEFAULT NULL,
  p_prazo date DEFAULT NULL,
  p_categoria text DEFAULT 'outros',
  p_tipo_arrecadacao text DEFAULT 'aberta',
  p_valor_item numeric DEFAULT NULL,
  p_prazo_cadastro date DEFAULT NULL,
  p_prazo_pagamento date DEFAULT NULL
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

  IF p_titulo IS NULL OR trim(p_titulo) = '' THEN
    RAISE EXCEPTION 'Título da meta é obrigatório';
  END IF;

  IF p_tipo_arrecadacao = 'item'
     AND (p_valor_item IS NULL OR p_valor_item <= 0) THEN
    RAISE EXCEPTION 'Informe o valor por item (custo fixo)';
  END IF;

  IF p_valor_alvo IS NOT NULL AND p_valor_alvo <= 0 THEN
    RAISE EXCEPTION 'Valor alvo inválido';
  END IF;

  IF p_prazo_cadastro IS NOT NULL
     AND p_prazo_pagamento IS NOT NULL
     AND p_prazo_pagamento < p_prazo_cadastro THEN
    RAISE EXCEPTION 'O prazo de pagamento deve ser depois do prazo de cadastro';
  END IF;

  INSERT INTO public.metas (
    titulo,
    descricao,
    imagem_url,
    valor_alvo,
    prazo,
    categoria,
    criado_por,
    tipo_arrecadacao,
    valor_item,
    prazo_cadastro,
    prazo_pagamento
  )
  VALUES (
    p_titulo,
    COALESCE(p_descricao, ''),
    p_imagem_url,
    p_valor_alvo,
    p_prazo,
    p_categoria,
    v_admin,
    p_tipo_arrecadacao,
    CASE WHEN p_tipo_arrecadacao = 'item' THEN p_valor_item ELSE NULL END,
    CASE WHEN p_tipo_arrecadacao = 'item' THEN p_prazo_cadastro ELSE NULL END,
    CASE WHEN p_tipo_arrecadacao = 'item' THEN p_prazo_pagamento ELSE NULL END
  )
  RETURNING id
  INTO v_meta_id;

  -- Evento social
  PERFORM public.cria_evento_feed(
    'META_CRIADA',
    v_admin,
    NULL,
    p_titulo,
    'Nova meta criada',
    jsonb_build_object(
      'meta_id', v_meta_id,
      'categoria', p_categoria,
      'valor_alvo', p_valor_alvo,
      'tipo_arrecadacao', p_tipo_arrecadacao,
      'valor_item', p_valor_item
    ),
    'meta_criada:' || v_meta_id
  );

  RETURN v_meta_id;

END;
$$;


REVOKE ALL
ON FUNCTION public.criar_meta_admin(text, text, text, numeric, date, text, text, numeric, date, date)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.criar_meta_admin(text, text, text, numeric, date, text, text, numeric, date, date)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.criar_meta_admin(text, text, text, numeric, date, text, text, numeric, date, date)
TO service_role;


-- ============================================================================
-- 5. ATUALIZAR META — ADMIN (ESTENDIDO)
-- ============================================================================

DROP FUNCTION IF EXISTS public.atualizar_meta_admin(uuid, text, text, text, numeric, date, text, text);

CREATE OR REPLACE FUNCTION public.atualizar_meta_admin(
  p_meta_id uuid,
  p_titulo text DEFAULT NULL,
  p_descricao text DEFAULT NULL,
  p_imagem_url text DEFAULT NULL,
  p_valor_alvo numeric DEFAULT NULL,
  p_prazo date DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_tipo_arrecadacao text DEFAULT NULL,
  p_valor_item numeric DEFAULT NULL,
  p_prazo_cadastro date DEFAULT NULL,
  p_prazo_pagamento date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_meta public.metas%ROWTYPE;
  v_novo_tipo text;
  v_novo_status text;
BEGIN

  IF NOT public.tem_papel(v_admin, 'administrador') THEN
    RAISE EXCEPTION 'Somente a diretoria pode editar metas';
  END IF;

  SELECT *
  INTO v_meta
  FROM public.metas
  WHERE id = p_meta_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Meta não encontrada';
  END IF;

  v_novo_tipo := COALESCE(p_tipo_arrecadacao, v_meta.tipo_arrecadacao);
  v_novo_status := COALESCE(p_status, v_meta.status);

  IF v_novo_tipo = 'item'
     AND COALESCE(p_valor_item, v_meta.valor_item) IS NULL
     AND v_meta.valor_item IS NULL THEN
    RAISE EXCEPTION 'Informe o valor por item (custo fixo)';
  END IF;

  IF COALESCE(p_valor_item, v_meta.valor_item) IS NOT NULL
     AND COALESCE(p_valor_item, v_meta.valor_item) <= 0 THEN
    RAISE EXCEPTION 'Valor por item inválido';
  END IF;

  IF p_valor_alvo IS NOT NULL AND p_valor_alvo <= 0 THEN
    RAISE EXCEPTION 'Valor alvo inválido';
  END IF;

  IF p_categoria IS NOT NULL
     AND p_categoria NOT IN ('material_esportivo', 'eventos', 'resenha', 'infraestrutura', 'uniforme', 'outros') THEN
    RAISE EXCEPTION 'Categoria de meta inválida';
  END IF;

  IF p_status IS NOT NULL
     AND p_status NOT IN ('ativa', 'encerrada', 'atingida') THEN
    RAISE EXCEPTION 'Status de meta inválido';
  END IF;

  IF p_tipo_arrecadacao IS NOT NULL
     AND p_tipo_arrecadacao NOT IN ('aberta', 'item') THEN
    RAISE EXCEPTION 'Tipo de arrecadação inválido';
  END IF;

  UPDATE public.metas
  SET
    titulo            = COALESCE(p_titulo, titulo),
    descricao         = COALESCE(p_descricao, descricao),
    imagem_url        = COALESCE(p_imagem_url, imagem_url),
    valor_alvo        = COALESCE(p_valor_alvo, valor_alvo),
    prazo             = COALESCE(p_prazo, prazo),
    categoria         = COALESCE(p_categoria, categoria),
    status            = COALESCE(p_status, status),
    tipo_arrecadacao  = v_novo_tipo,
    valor_item        = CASE WHEN v_novo_tipo = 'item' THEN COALESCE(p_valor_item, valor_item) ELSE NULL END,
    prazo_cadastro    = CASE WHEN v_novo_tipo = 'item' THEN COALESCE(p_prazo_cadastro, prazo_cadastro) ELSE NULL END,
    prazo_pagamento   = CASE WHEN v_novo_tipo = 'item' THEN COALESCE(p_prazo_pagamento, prazo_pagamento) ELSE NULL END,
    atualizado_em     = now()
  WHERE id = p_meta_id;

  -- Meta atingida manualmente pelo administrador.
  IF v_novo_status = 'atingida'
     AND v_meta.status <> 'atingida' THEN
    PERFORM public.cria_evento_feed(
      'META_ATINGIDA',
      v_admin,
      NULL,
      'Meta atingida!',
      v_meta.titulo,
      jsonb_build_object('meta_id', p_meta_id),
      'meta_atingida:' || p_meta_id
    );
  END IF;

END;
$$;


REVOKE ALL
ON FUNCTION public.atualizar_meta_admin(uuid, text, text, text, numeric, date, text, text, text, numeric, date, date)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.atualizar_meta_admin(uuid, text, text, text, numeric, date, text, text, text, numeric, date, date)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.atualizar_meta_admin(uuid, text, text, text, numeric, date, text, text, text, numeric, date, date)
TO service_role;


-- ============================================================================
-- 6. VERIFICAÇÕES FINAIS (INFORMATIVAS)
-- ============================================================================
--
-- SELECT id, titulo, tipo_arrecadacao, valor_item, prazo_cadastro, prazo_pagamento
-- FROM public.metas ORDER BY criado_em DESC;
--
-- SELECT * FROM public.contribuicoes_meta
-- WHERE nome_camisa IS NOT NULL ORDER BY criado_em DESC;
--
-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
