-- ============================================================================
-- Fut Cajazeiras — METAS: COLETES GENÉRICOS (sem cadastro prévio)
-- Data: 2026-09-10
-- Banco: Supabase / PostgreSQL
--
-- SCRIPT IDEMPOTENTE.
--
-- REGRA NOVA
--   A diretoria pode criar uma meta de arrecadação por item apenas informando
--   o VALOR INDIVIDUAL daquele item (ex.: colete R$ 71), até bater a meta
--   coletiva. Não existe cadastro/CRUD prévio de itens nem chave estrangeira:
--   o item é "genérico".
--
--   Nesse modo, o associado manifesta o interesse com 1 clique e NÃO precisa
--   preencher personalização (nome/tamanho/número na camisa). Todos os itens
--   genéricos usam o mesmo tamanho padrão (`metas.tamanho_padrao`).
--
--   Metas que exigem personalização (ex.: camisa com nome/número) continuam
--   funcionando: basta marcar `exige_personalizacao = true`.
--
-- CONTEÚDO
--   1. metas.exige_personalizacao / metas.tamanho_padrao
--   2. cadastrar_interesse_item — personalização OPCIONAL
--   3. criar_meta_admin / atualizar_meta_admin estendidos
-- ============================================================================


-- ============================================================================
-- 1. METAS — PERSONALIZAÇÃO OPCIONAL + TAMANHO PADRÃO
-- ============================================================================

-- false (padrão) = item genérico (colete comum, sem personalização).
ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS exige_personalizacao boolean NOT NULL DEFAULT false;

-- Tamanho único aplicado aos itens genéricos.
ALTER TABLE public.metas
  ADD COLUMN IF NOT EXISTS tamanho_padrao text NOT NULL DEFAULT 'Único';

COMMENT ON COLUMN public.metas.exige_personalizacao IS
  'true = exige nome/tamanho/número na camisa ao contribuir; false = item genérico (colete padrão, sem personalização).';
COMMENT ON COLUMN public.metas.tamanho_padrao IS
  'Tamanho único dos itens genéricos. Usado quando exige_personalizacao = false.';


-- ============================================================================
-- 2. RPC — CADASTRAR INTERESSE EM ITEM (PERSONALIZAÇÃO OPCIONAL)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cadastrar_interesse_item(
  p_meta_id uuid,
  p_nome_camisa text DEFAULT NULL,
  p_tamanho text DEFAULT NULL,
  p_numero_camisa text DEFAULT NULL
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

  -- Personalização só é exigida quando a meta declarar isso.
  -- item genérico (colete comum): cadastro em 1 clique, sem dados de camisa.
  IF v_meta.exige_personalizacao THEN
    IF trim(COALESCE(p_nome_camisa, '')) = ''
       OR trim(COALESCE(p_tamanho, '')) = ''
       OR trim(COALESCE(p_numero_camisa, '')) = '' THEN
      RAISE EXCEPTION 'Preencha nome, tamanho e número da camisa';
    END IF;
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
    CASE WHEN v_meta.exige_personalizacao THEN trim(p_nome_camisa) ELSE NULL END,
    COALESCE(
      NULLIF(trim(COALESCE(p_tamanho, '')), ''),
      v_meta.tamanho_padrao,
      'Único'
    ),
    CASE WHEN v_meta.exige_personalizacao THEN trim(p_numero_camisa) ELSE NULL END
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
-- 3. CRIAR META — ADMIN (ESTENDIDO)
-- ============================================================================

DROP FUNCTION IF EXISTS public.criar_meta_admin(text, text, text, numeric, date, text, text, numeric, date, date);

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
  p_prazo_pagamento date DEFAULT NULL,
  p_exige_personalizacao boolean DEFAULT false,
  p_tamanho_padrao text DEFAULT NULL
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

  -- Item (inclusive o genérico) exige o valor individual.
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
    prazo_pagamento,
    exige_personalizacao,
    tamanho_padrao
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
    CASE WHEN p_tipo_arrecadacao = 'item' THEN p_prazo_pagamento ELSE NULL END,
    COALESCE(p_exige_personalizacao, false),
    COALESCE(NULLIF(trim(COALESCE(p_tamanho_padrao, '')), ''), 'Único')
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
ON FUNCTION public.criar_meta_admin(text, text, text, numeric, date, text, text, numeric, date, date, boolean, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.criar_meta_admin(text, text, text, numeric, date, text, text, numeric, date, date, boolean, text)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.criar_meta_admin(text, text, text, numeric, date, text, text, numeric, date, date, boolean, text)
TO service_role;


-- ============================================================================
-- 4. ATUALIZAR META — ADMIN (ESTENDIDO)
-- ============================================================================

DROP FUNCTION IF EXISTS public.atualizar_meta_admin(uuid, text, text, text, numeric, date, text, text, text, numeric, date, date);

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
  p_prazo_pagamento date DEFAULT NULL,
  p_exige_personalizacao boolean DEFAULT NULL,
  p_tamanho_padrao text DEFAULT NULL
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
    titulo                = COALESCE(p_titulo, titulo),
    descricao             = COALESCE(p_descricao, descricao),
    imagem_url            = COALESCE(p_imagem_url, imagem_url),
    valor_alvo            = COALESCE(p_valor_alvo, valor_alvo),
    prazo                 = COALESCE(p_prazo, prazo),
    categoria             = COALESCE(p_categoria, categoria),
    status                = COALESCE(p_status, status),
    tipo_arrecadacao      = v_novo_tipo,
    valor_item            = CASE WHEN v_novo_tipo = 'item' THEN COALESCE(p_valor_item, valor_item) ELSE NULL END,
    prazo_cadastro        = CASE WHEN v_novo_tipo = 'item' THEN COALESCE(p_prazo_cadastro, prazo_cadastro) ELSE NULL END,
    prazo_pagamento       = CASE WHEN v_novo_tipo = 'item' THEN COALESCE(p_prazo_pagamento, prazo_pagamento) ELSE NULL END,
    exige_personalizacao  = COALESCE(p_exige_personalizacao, exige_personalizacao),
    tamanho_padrao        = COALESCE(NULLIF(trim(COALESCE(p_tamanho_padrao, '')), ''), tamanho_padrao),
    atualizado_em         = now()
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
ON FUNCTION public.atualizar_meta_admin(uuid, text, text, text, numeric, date, text, text, text, numeric, date, date, boolean, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.atualizar_meta_admin(uuid, text, text, text, numeric, date, text, text, text, numeric, date, date, boolean, text)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.atualizar_meta_admin(uuid, text, text, text, numeric, date, text, text, text, numeric, date, date, boolean, text)
TO service_role;


-- ============================================================================
-- VERIFICAÇÕES (INFORMATIVAS)
-- ============================================================================
-- SELECT id, titulo, tipo_arrecadacao, valor_item, exige_personalizacao, tamanho_padrao
--   FROM public.metas ORDER BY criado_em DESC;
-- ============================================================================
