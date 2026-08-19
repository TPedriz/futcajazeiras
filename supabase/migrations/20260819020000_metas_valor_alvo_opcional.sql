-- ============================================================================
-- Fut Cajazeiras — METAS: valor_alvo OPCIONAL para arrecadação por item
-- Data: 2026-08-19
-- Banco: Supabase / PostgreSQL
--
-- CORREÇÃO: ao criar meta do tipo "item" (ex.: coletes R$ 71), o campo
-- valor_alvo era NOT NULL na tabela metas, mas o cadastro por item usa
-- valor_item (custo fixo). Esta migration:
--   1. Torna valor_alvo opcional (permite NULL) — necessário para metas de item
--   2. Mantém a exigência de valor_alvo > 0 para metas abertas (aberta)
--   3. Atualiza criar_meta_admin / atualizar_meta_admin com validações claras
--
-- IDEMPOTENTE — pode rodar novamente sem erro.
-- ============================================================================


-- ============================================================================
-- 1. CONSTRAINT: valor_alvo opcional para meta por item
-- ============================================================================

-- Remove a constraint antiga do CREATE TABLE (inline CHECK (valor_alvo > 0)).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'metas_valor_alvo_check'
  ) THEN
    ALTER TABLE public.metas DROP CONSTRAINT metas_valor_alvo_check;
  END IF;
END $$;

-- Torna a coluna opcional (NULL permitido).
ALTER TABLE public.metas
  ALTER COLUMN valor_alvo DROP NOT NULL;

-- Nova regra:
--   - aberta  → valor_alvo OBRIGATÓRIO (> 0)
--   - item    → valor_alvo opcional (NULL ou > 0)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'metas_valor_alvo_item_opcional_check'
  ) THEN
    ALTER TABLE public.metas
      ADD CONSTRAINT metas_valor_alvo_item_opcional_check
      CHECK (
        (valor_alvo IS NULL AND tipo_arrecadacao = 'item')
        OR valor_alvo > 0
      );
  END IF;
END $$;


-- ============================================================================
-- 2. CRIAR META — ADMIN (validação de valor_alvo para meta aberta)
-- ============================================================================

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

  -- Meta aberta exige valor alvo maior que zero.
  IF p_tipo_arrecadacao = 'aberta'
     AND (p_valor_alvo IS NULL OR p_valor_alvo <= 0) THEN
    RAISE EXCEPTION 'Meta aberta exige um valor alvo maior que zero';
  END IF;

  -- Meta por item exige custo fixo por item.
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
-- 3. ATUALIZAR META — ADMIN (validação de valor_alvo para meta aberta)
-- ============================================================================

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
  v_novo_alvo numeric;
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
  v_novo_alvo := COALESCE(p_valor_alvo, v_meta.valor_alvo);

  -- Meta aberta (resultante) exige valor alvo maior que zero.
  IF v_novo_tipo = 'aberta'
     AND (v_novo_alvo IS NULL OR v_novo_alvo <= 0) THEN
    RAISE EXCEPTION 'Meta aberta exige um valor alvo maior que zero';
  END IF;

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
-- 4. VERIFICAÇÃO (INFORMATIVA)
-- ============================================================================
--
-- SELECT column_name, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'public' AND table_name = 'metas'
--   AND column_name = 'valor_alvo';
-- -- Esperado: is_nullable = YES
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conname IN ('metas_valor_alvo_item_opcional_check', 'metas_valor_alvo_check');
-- -- Esperado: apenas metas_valor_alvo_item_opcional_check (a antiga foi removida)
--
-- ============================================================================
-- FIM DO SCRIPT
-- ============================================================================
