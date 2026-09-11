-- ============================================================================
-- Fut Cajazeiras — FINANCEIRO: INADIMPLÊNCIA, MULTAS E RETOMADA DE VÍNCULO
-- Data: 2026-09-10
-- Banco: Supabase / PostgreSQL
--
-- SCRIPT IDEMPOTENTE — pode ser executado novamente sem perda de histórico.
--
-- CONTEÚDO
--   1. Estado da conta do associado (perfis.status_conta: ATIVO | INADIMPLENTE)
--   2. Multa por atraso (configurável; padrão R$ 5,00) refletida em `mensalidades`
--   3. Taxa de Associação (reinscrição) configurável
--   4. Rotina de checagem de vencimento (multa + suspensão por 1 mês de atraso)
--   5. Regularização (retomada de vínculo): débitos + multas + taxa em 1 PIX
--   6. Cron diário (pg_cron, quando disponível) + execução em tempo de execução
--
-- ----------------------------------------------------------------------------
-- REGRA INTERNA (NÃO DIVULGAR EM DOCUMENTAÇÃO PÚBLICA / README / AJUDA):
--   Associados com o papel `administrador` (DIRETORIA) são IMUNES ao sistema
--   de multas e à mudança de status para INADIMPLENTE. Toda rotina de bloqueio
--   ignora esses perfis (vide `eh_diretoria` / `atualiza_situacao_financeira`).
--   Esta exceção existe apenas no código-fonte e na documentação técnica de
--   backend (docs/backend.md).
-- ----------------------------------------------------------------------------
-- ============================================================================


-- ============================================================================
-- 1. CONFIGURAÇÕES PARAMETRIZÁVEIS
-- ============================================================================

INSERT INTO public.configuracoes (chave, valor)
SELECT 'valor_multa_atraso', 5
WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes WHERE chave = 'valor_multa_atraso');

INSERT INTO public.configuracoes (chave, valor)
SELECT 'valor_taxa_associacao', public.valor_mensalidade()
WHERE NOT EXISTS (SELECT 1 FROM public.configuracoes WHERE chave = 'valor_taxa_associacao');

-- Valor da multa por atraso (editável pela diretoria).
CREATE OR REPLACE FUNCTION public.valor_multa_atraso()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT valor FROM public.configuracoes WHERE chave = 'valor_multa_atraso'),
    5::numeric
  );
$$;

-- Taxa de Associação (reinscrição). Fallback: valor atual da mensalidade.
CREATE OR REPLACE FUNCTION public.valor_taxa_associacao()
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT valor FROM public.configuracoes WHERE chave = 'valor_taxa_associacao'),
    public.valor_mensalidade()
  );
$$;

REVOKE ALL ON FUNCTION public.valor_multa_atraso() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.valor_taxa_associacao() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valor_multa_atraso() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.valor_taxa_associacao() TO authenticated, service_role;


-- ============================================================================
-- 2. ESTADO DA CONTA (perfis.status_conta)
-- ============================================================================

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS status_conta text NOT NULL DEFAULT 'ATIVO';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'perfis_status_conta_check'
  ) THEN
    ALTER TABLE public.perfis
      ADD CONSTRAINT perfis_status_conta_check
      CHECK (status_conta IN ('ATIVO', 'INADIMPLENTE'));
  END IF;
END $$;

COMMENT ON COLUMN public.perfis.status_conta IS
  'Estado da associação: ATIVO (em dia) ou INADIMPLENTE (suspenso por 1+ mês de atraso). A diretoria é imune.';

-- A diretoria é sempre ATIVO.
UPDATE public.perfis p
   SET status_conta = 'ATIVO'
 WHERE p.status_conta <> 'ATIVO'
   AND public.tem_papel(p.id, 'administrador');

-- Função auxiliar: a diretoria (papel administrador) é imune ao financeiro.
CREATE OR REPLACE FUNCTION public.eh_diretoria(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(public.tem_papel(_user_id, 'administrador'), false);
$$;

REVOKE ALL ON FUNCTION public.eh_diretoria(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eh_diretoria(uuid) TO authenticated, service_role;

-- Protege o status da conta contra auto-elevação: o próprio associado não pode
-- voltar para ATIVO (isso só ocorre via regularização paga ou pela diretoria).
-- As rotinas internas sinalizam a transação com a GUC `app.rotina_financeira`
-- para poderem escrever livremente.
CREATE OR REPLACE FUNCTION public.protege_status_conta()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NEW.status_conta IS DISTINCT FROM OLD.status_conta
     AND auth.uid() IS NOT NULL
     AND NOT public.eh_diretoria(auth.uid())
     AND COALESCE(current_setting('app.rotina_financeira', true), 'off') <> 'on' THEN
    NEW.status_conta := OLD.status_conta;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protege_status_conta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_protege_status_conta ON public.perfis;
CREATE TRIGGER trg_protege_status_conta
  BEFORE UPDATE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.protege_status_conta();


-- ============================================================================
-- 3. MULTAS NAS MENSALIDADES
-- ============================================================================

ALTER TABLE public.mensalidades
  ADD COLUMN IF NOT EXISTS multa_valor numeric(10,2) NOT NULL DEFAULT 0;

ALTER TABLE public.mensalidades
  ADD COLUMN IF NOT EXISTS multa_aplicada_em timestamptz;

-- Vínculo opcional com uma regularização (retomada de vínculo).
ALTER TABLE public.mensalidades
  ADD COLUMN IF NOT EXISTS regularizacao_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mensalidades_multa_valor_check'
  ) THEN
    ALTER TABLE public.mensalidades
      ADD CONSTRAINT mensalidades_multa_valor_check CHECK (multa_valor >= 0);
  END IF;
END $$;

COMMENT ON COLUMN public.mensalidades.multa_valor IS
  'Acréscimo por atraso, calculado a partir de configuracoes.valor_multa_atraso. Idempotente.';
COMMENT ON COLUMN public.mensalidades.multa_aplicada_em IS
  'Quando a multa foi lançada pela primeira vez (evita duplicidade na rotina).';

-- Obs.: a multa não precisa de trigger de proteção. As políticas de RLS de
-- `mensalidades` só permitem UPDATE para a diretoria; o associado apenas lê.


-- ============================================================================
-- 4. REGULARIZAÇÃO (RETOMADA DE VÍNCULO)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.regularizacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  valor_debitos   numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor_debitos >= 0),
  taxa_associacao numeric(10,2) NOT NULL DEFAULT 0 CHECK (taxa_associacao >= 0),
  valor_total     numeric(10,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  status          text NOT NULL DEFAULT 'pendente',   -- pendente | pago | cancelado
  criado_por      uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  pago_em         timestamptz
);

CREATE INDEX IF NOT EXISTS idx_regularizacoes_usuario
  ON public.regularizacoes (usuario_id, criado_em DESC);

-- No máximo uma regularização em aberto por associado (idempotência).
CREATE UNIQUE INDEX IF NOT EXISTS uq_regularizacoes_pendente
  ON public.regularizacoes (usuario_id)
  WHERE status = 'pendente';

COMMENT ON TABLE public.regularizacoes IS
  'Retomada de vínculo de associado inadimplente: débitos retroativos + multas + taxa de associação em uma cobrança única.';

ALTER TABLE public.regularizacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario le a propria regularizacao" ON public.regularizacoes;
CREATE POLICY "Usuario le a propria regularizacao" ON public.regularizacoes
  FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id OR public.tem_papel(auth.uid(), 'administrador'));

GRANT SELECT ON public.regularizacoes TO authenticated;
GRANT ALL ON public.regularizacoes TO service_role;

-- Dados sensíveis do PIX da regularização (padrão `mensalidades`/`presencas_pagamento`).
CREATE TABLE IF NOT EXISTS public.regularizacoes_pagamento (
  regularizacao_id uuid PRIMARY KEY REFERENCES public.regularizacoes(id) ON DELETE CASCADE,
  mp_payment_id    text,
  mp_status        text,
  pix_qr_code      text,
  pix_qr_base64    text,
  pix_expira_em    timestamptz,
  criado_em        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.regularizacoes_pagamento ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.regularizacoes_pagamento TO service_role;


-- ============================================================================
-- 5. FUNÇÕES DA ROTINA FINANCEIRA
-- ============================================================================

-- Aplica a multa vigente nas mensalidades vencidas e ainda pendentes do
-- associado. Idempotente: repetir no mesmo dia mantém o mesmo valor.
CREATE OR REPLACE FUNCTION public.aplica_multas_usuario(_usuario_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_valor numeric;
  v_qtd   integer := 0;
BEGIN
  -- DIRETORIA É IMUNE.
  IF public.eh_diretoria(_usuario_id) THEN
    RETURN 0;
  END IF;

  v_valor := public.valor_multa_atraso();
  IF v_valor IS NULL OR v_valor <= 0 THEN
    RETURN 0;
  END IF;

  WITH alvo AS (
    UPDATE public.mensalidades m
       SET multa_valor       = v_valor,
           multa_aplicada_em = COALESCE(m.multa_aplicada_em, now())
     WHERE m.usuario_id = _usuario_id
       AND m.status = 'pendente'
       AND m.vencimento < CURRENT_DATE
    RETURNING 1
  )
  SELECT count(*) INTO v_qtd FROM alvo;

  RETURN v_qtd;
END;
$$;

REVOKE ALL ON FUNCTION public.aplica_multas_usuario(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aplica_multas_usuario(uuid) TO service_role;


-- Aplica multas + avalia suspensão (1 mês de atraso => INADIMPLENTE) do
-- associado. Notifica na transição para INADIMPLENTE. Idempotente.
CREATE OR REPLACE FUNCTION public.atualiza_situacao_financeira(_usuario_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user  uuid := COALESCE(_usuario_id, auth.uid());
  v_atual text;
  v_novo  text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não informado';
  END IF;

  IF auth.uid() IS NOT NULL
     AND auth.uid() <> v_user
     AND NOT public.eh_diretoria(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para atualizar a situação de outro associado';
  END IF;

  -- Autoriza a escrita do status dentro desta transação (ver protege_status_conta).
  PERFORM set_config('app.rotina_financeira', 'on', true);

  SELECT status_conta INTO v_atual
    FROM public.perfis
   WHERE id = v_user
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- DIRETORIA É IMUNE: nunca recebe multa nem vira INADIMPLENTE.
  IF public.eh_diretoria(v_user) THEN
    IF v_atual IS DISTINCT FROM 'ATIVO' THEN
      UPDATE public.perfis SET status_conta = 'ATIVO' WHERE id = v_user;
    END IF;
    RETURN 'ATIVO';
  END IF;

  PERFORM public.aplica_multas_usuario(v_user);

  IF EXISTS (
    SELECT 1
      FROM public.mensalidades m
     WHERE m.usuario_id = v_user
       AND m.status = 'pendente'
       AND (m.vencimento + INTERVAL '1 month')::date <= CURRENT_DATE
  ) THEN
    v_novo := 'INADIMPLENTE';
  ELSE
    v_novo := v_atual;
  END IF;

  IF v_novo IS DISTINCT FROM v_atual THEN
    UPDATE public.perfis SET status_conta = v_novo WHERE id = v_user;

    IF v_novo = 'INADIMPLENTE' THEN
      PERFORM public.notifica(
        v_user,
        'financeiro',
        'Associação suspensa por inadimplência',
        'Sua mensalidade está em aberto há mais de um mês. Sua conta foi marcada como inadimplente e os direitos de associação ficaram suspensos. Para retomar, quite os débitos em aberto e a nova taxa de associação.',
        '/pagamentos'
      );
    END IF;
  END IF;

  PERFORM set_config('app.rotina_financeira', 'off', true);
  RETURN v_novo;
END;
$$;

REVOKE ALL ON FUNCTION public.atualiza_situacao_financeira(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.atualiza_situacao_financeira(uuid) TO authenticated, service_role;


-- Rotina global (cron / diretoria): garante as mensalidades do mês e atualiza
-- multas + situação de todos os associados (ignorando a diretoria).
CREATE OR REPLACE FUNCTION public.rotina_financeira_diaria()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r        record;
  v_antes  text;
  v_novo   text;
  v_qtd    integer := 0;
BEGIN
  -- Chamada por usuário autenticado: somente a diretoria.
  IF auth.uid() IS NOT NULL AND NOT public.eh_diretoria(auth.uid()) THEN
    RAISE EXCEPTION 'Apenas a diretoria pode executar a rotina financeira';
  END IF;

  PERFORM public.garante_mensalidades_mes();

  FOR r IN
    SELECT p.id, p.status_conta
      FROM public.perfis p
     WHERE NOT public.eh_diretoria(p.id)
       AND EXISTS (
         SELECT 1 FROM public.mensalidades m
          WHERE m.usuario_id = p.id
            AND m.status = 'pendente'
            AND m.vencimento < CURRENT_DATE
       )
  LOOP
    v_antes := r.status_conta;
    v_novo  := public.atualiza_situacao_financeira(r.id);
    IF v_novo = 'INADIMPLENTE' AND v_antes IS DISTINCT FROM 'INADIMPLENTE' THEN
      v_qtd := v_qtd + 1;
    END IF;
  END LOOP;

  RETURN v_qtd;
END;
$$;

REVOKE ALL ON FUNCTION public.rotina_financeira_diaria() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rotina_financeira_diaria() TO authenticated, service_role;


-- Situação financeira completa do associado (usada pela UI).
CREATE OR REPLACE FUNCTION public.pendencias_financeiras(_usuario_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user   uuid := COALESCE(_usuario_id, auth.uid());
  v_status text;
  v_diret  boolean;
  v_itens  jsonb;
  v_total  numeric;
  v_taxa   numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não informado';
  END IF;

  IF auth.uid() IS NOT NULL
     AND auth.uid() <> v_user
     AND NOT public.eh_diretoria(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  SELECT COALESCE(p.status_conta, 'ATIVO'), public.eh_diretoria(v_user)
    INTO v_status, v_diret
    FROM public.perfis p
   WHERE p.id = v_user;

  SELECT COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'mensalidadeId', m.id,
               'referencia',    m.referencia,
               'vencimento',    m.vencimento,
               'valor',         m.valor,
               'multa',         COALESCE(m.multa_valor, 0),
               'total',         m.valor + COALESCE(m.multa_valor, 0),
               'atrasada',      m.vencimento < CURRENT_DATE
             ) ORDER BY m.referencia
           ),
           '[]'::jsonb
         ),
         COALESCE(sum(m.valor + COALESCE(m.multa_valor, 0)), 0)
    INTO v_itens, v_total
    FROM public.mensalidades m
   WHERE m.usuario_id = v_user
     AND m.status = 'pendente';

  v_taxa := public.valor_taxa_associacao();

  RETURN jsonb_build_object(
    'usuarioId',         v_user,
    'statusConta',       COALESCE(v_status, 'ATIVO'),
    'ehDiretoria',       COALESCE(v_diret, false),
    'mensalidades',      v_itens,
    'totalDebitos',      v_total,
    'valorMulta',        public.valor_multa_atraso(),
    'taxaAssociacao',    CASE WHEN v_status = 'INADIMPLENTE' THEN v_taxa ELSE 0 END,
    'totalRegularizacao', CASE WHEN v_status = 'INADIMPLENTE' THEN v_total + v_taxa ELSE v_total END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pendencias_financeiras(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pendencias_financeiras(uuid) TO authenticated, service_role;


-- Cria (ou reaproveita) a regularização do associado inadimplente.
-- Gera os meses retroativos faltantes desde o último pagamento, aplica multas
-- e soma a taxa de associação. Retorna o id da regularização (idempotente).
CREATE OR REPLACE FUNCTION public.criar_regularizacao(_usuario_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user      uuid := COALESCE(_usuario_id, auth.uid());
  v_perfil    public.perfis%ROWTYPE;
  v_status    text;
  v_inicio    date;
  v_ref       date;
  v_debitos   numeric;
  v_taxa      numeric;
  v_total     numeric;
  v_id        uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Usuário não informado';
  END IF;

  IF auth.uid() IS NOT NULL
     AND auth.uid() <> v_user
     AND NOT public.eh_diretoria(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão';
  END IF;

  -- DIRETORIA É IMUNE: não participa do sistema de multas/regularização.
  IF public.eh_diretoria(v_user) THEN
    RAISE EXCEPTION 'A diretoria não participa do sistema de multas';
  END IF;

  SELECT * INTO v_perfil FROM public.perfis WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  PERFORM public.atualiza_situacao_financeira(v_user);
  SELECT status_conta INTO v_status FROM public.perfis WHERE id = v_user;

  IF v_status <> 'INADIMPLENTE' THEN
    RAISE EXCEPTION 'A conta não está inadimplente';
  END IF;

  -- 1) Backfill dos meses faltantes: do mês seguinte ao último pagamento
  --    (ou do cadastro, se nunca pagou) até o mês corrente.
  SELECT COALESCE(
           (SELECT (max(m.referencia) + INTERVAL '1 month')::date
              FROM public.mensalidades m
             WHERE m.usuario_id = v_user AND m.status = 'pago'),
           date_trunc('month', v_perfil.criado_em)::date
         )
    INTO v_inicio;

  IF v_inicio IS NOT NULL AND v_inicio <= date_trunc('month', now())::date THEN
    FOR v_ref IN
      SELECT gs::date
        FROM generate_series(v_inicio, date_trunc('month', now())::date, INTERVAL '1 month') gs
    LOOP
      INSERT INTO public.mensalidades (usuario_id, referencia, vencimento, valor)
      VALUES (v_user, v_ref, v_ref, public.valor_mensalidade())
      ON CONFLICT (usuario_id, referencia) DO NOTHING;
    END LOOP;
  END IF;

  PERFORM public.aplica_multas_usuario(v_user);

  SELECT COALESCE(sum(m.valor + COALESCE(m.multa_valor, 0)), 0)
    INTO v_debitos
    FROM public.mensalidades m
   WHERE m.usuario_id = v_user
     AND m.status = 'pendente';

  v_taxa  := public.valor_taxa_associacao();
  v_total := v_debitos + v_taxa;

  SELECT id INTO v_id
    FROM public.regularizacoes
   WHERE usuario_id = v_user
     AND status = 'pendente';

  IF v_id IS NULL THEN
    INSERT INTO public.regularizacoes (
      usuario_id, valor_debitos, taxa_associacao, valor_total, status, criado_por
    )
    VALUES (v_user, v_debitos, v_taxa, v_total, 'pendente', auth.uid())
    RETURNING id INTO v_id;
  ELSE
    UPDATE public.regularizacoes
       SET valor_debitos   = v_debitos,
           taxa_associacao = v_taxa,
           valor_total     = v_total,
           atualizado_em   = now(),
           criado_por      = COALESCE(criado_por, auth.uid())
     WHERE id = v_id;

    -- O valor mudou: invalida o PIX anterior para forçar novo QR.
    UPDATE public.regularizacoes_pagamento
       SET mp_payment_id = NULL,
           mp_status     = NULL,
           pix_qr_code   = NULL,
           pix_qr_base64 = NULL,
           pix_expira_em = NULL
     WHERE regularizacao_id = v_id;
  END IF;

  UPDATE public.mensalidades
     SET regularizacao_id = v_id
   WHERE usuario_id = v_user
     AND status = 'pendente';

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_regularizacao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_regularizacao(uuid) TO authenticated, service_role;


-- Confirma o pagamento da regularização: quita os débitos e devolve o vínculo.
-- Executada no servidor (service_role) após aprovação do PIX. Idempotente.
CREATE OR REPLACE FUNCTION public.confirmar_regularizacao(_regularizacao_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_reg public.regularizacoes%ROWTYPE;
BEGIN
  SELECT * INTO v_reg
    FROM public.regularizacoes
   WHERE id = _regularizacao_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Regularização não encontrada';
  END IF;

  IF v_reg.status = 'pago' THEN
    RETURN; -- idempotente
  END IF;

  PERFORM set_config('app.rotina_financeira', 'on', true);

  -- Quita todos os débitos pendentes do associado.
  UPDATE public.mensalidades
     SET status        = 'pago',
         pago_em       = now(),
         mp_payment_id = NULL,
         mp_status     = NULL,
         pix_qr_code   = NULL,
         pix_qr_base64 = NULL,
         pix_expira_em = NULL
   WHERE usuario_id = v_reg.usuario_id
     AND status = 'pendente';

  UPDATE public.regularizacoes
     SET status = 'pago', pago_em = now(), atualizado_em = now()
   WHERE id = v_reg.id;

  -- Retoma o vínculo.
  UPDATE public.perfis
     SET status_conta = 'ATIVO'
   WHERE id = v_reg.usuario_id;

  PERFORM public.notifica(
    v_reg.usuario_id,
    'financeiro',
    'Vínculo restabelecido!',
    'Recebemos o pagamento da sua regularização. Todos os débitos foram quitados e sua associação está ativa novamente.',
    '/pagamentos'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_regularizacao(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirmar_regularizacao(uuid) TO service_role;


-- ============================================================================
-- 6. AGENDAMENTO DIÁRIO (pg_cron) — quando disponível
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_cron não pôde ser habilitado automaticamente (habilite no painel do Supabase).';
    END;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- 12:00 UTC = 09:00 (America/Bahia)
    PERFORM cron.schedule(
      'fut-rotina-financeira-diaria',
      '0 12 * * *',
      'SELECT public.rotina_financeira_diaria()'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Agendamento via pg_cron indisponível: %', SQLERRM;
END $$;


-- ============================================================================
-- 7. BACKFILL INICIAL (informativo, idempotente)
-- ============================================================================

SELECT public.rotina_financeira_diaria();


-- ============================================================================
-- VERIFICAÇÕES (INFORMATIVAS)
-- ============================================================================
-- SELECT chave, valor FROM public.configuracoes
--  WHERE chave IN ('valor_multa_atraso', 'valor_taxa_associacao');
--
-- SELECT id, nome, status_conta FROM public.perfis WHERE NOT public.eh_diretoria(id);
--
-- SELECT referencia, vencimento, valor, multa_valor, status
--   FROM public.mensalidades ORDER BY referencia DESC;
-- ============================================================================
