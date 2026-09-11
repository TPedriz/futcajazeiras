-- ============================================================================
-- Fut Cajazeiras — INADIMPLÊNCIA: SOMENTE ASSOCIADOS + REBAIXAMENTO AUTOMÁTICO
-- Data: 2026-09-10
-- Banco: Supabase / PostgreSQL
--
-- SCRIPT IDEMPOTENTE — pode ser executado novamente sem perda de histórico.
--
-- REGRAS (substituem/complementam a migration 20260910000000)
--
--   1. O motor de inadimplência (multa + suspensão) só vale para quem TEM
--      obrigação de mensalidade, isto é, quem possui o cargo de ASSOCIADO.
--      - Convidados (nunca associados) não recebem mensalidade, multa nem
--        suspensão: a rotina ignora completamente esses perfis.
--      - Quem tem cargo `administrador` (DIRETORIA) continua IMUNE.
--
--   2. Quem entra em INADIMPLENTE PERDE o cargo de associado e é rebaixado
--      automaticamente para CONVIDADO. Para retomar o vínculo (ATIVO +
--      associado) é preciso quitar os débitos + Taxa de Associação, como já
--      definido na regularização.
--
--   3. AUTORIDADE DA DIRETORIA: qualquer decisão manual da diretoria congela o
--      caso (`perfis.financeiro_automatico = false`) e a rotina deixa de mexer
--      naquele usuário. A diretoria pode:
--        - suspender/rebaixar  -> `admin_definir_situacao_associado(id,'suspender')`
--        - reativar/promover   -> `admin_definir_situacao_associado(id,'reativar')`
--        - devolver ao automático -> `admin_definir_situacao_associado(id,'automatico')`
--      (os cargos também continuam livres em Admin > Cargos.)
--      O pagamento da regularização devolve o caso ao modo automático.
--
-- ----------------------------------------------------------------------------
-- REGRA INTERNA (NÃO DIVULGAR EM DOCUMENTAÇÃO PÚBLICA / README / AJUDA):
--   A imunidade da DIRETORIA e a existência do modo de gestão manual são
--   detalhes de implementação, documentados apenas aqui e em docs/backend.md.
-- ----------------------------------------------------------------------------
-- ============================================================================


-- ============================================================================
-- 1. ESTADO DE GESTÃO (manual x automático)
-- ============================================================================

-- true  = multas/suspensão geridas automaticamente pelo sistema (padrão).
-- false = a diretoria assumiu o caso; a rotina não altera mais nada.
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS financeiro_automatico boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.perfis.financeiro_automatico IS
  'true = multas/suspensão/rebaixamento automáticos; false = caso sob gestão manual da diretoria (rotina ignora).';


-- ============================================================================
-- 2. HELPERS
-- ============================================================================

-- Possui obrigação de mensalidade? (cargo de associado)
CREATE OR REPLACE FUNCTION public.eh_associado(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(public.tem_papel(_user_id, 'associado'), false);
$$;

REVOKE ALL ON FUNCTION public.eh_associado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eh_associado(uuid) TO authenticated, service_role;

-- Rebaixa o usuário para convidado (remove os demais cargos).
-- Nunca deve ser usada na diretoria.
CREATE OR REPLACE FUNCTION public.rebaixa_para_convidado(_usuario_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.eh_diretoria(_usuario_id) THEN
    RAISE EXCEPTION 'A diretoria é imune: não pode ser rebaixada';
  END IF;

  DELETE FROM public.papeis_usuario WHERE user_id = _usuario_id;

  INSERT INTO public.papeis_usuario (user_id, papel)
  VALUES (_usuario_id, 'convidado')
  ON CONFLICT (user_id, papel) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.rebaixa_para_convidado(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rebaixa_para_convidado(uuid) TO service_role;

-- (Re)promove o usuário a associado (remove os demais cargos).
CREATE OR REPLACE FUNCTION public.promove_para_associado(_usuario_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.eh_diretoria(_usuario_id) THEN
    RAISE EXCEPTION 'A diretoria é imune: cargo não deve ser alterado por aqui';
  END IF;

  DELETE FROM public.papeis_usuario WHERE user_id = _usuario_id;

  INSERT INTO public.papeis_usuario (user_id, papel)
  VALUES (_usuario_id, 'associado')
  ON CONFLICT (user_id, papel) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.promove_para_associado(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promove_para_associado(uuid) TO service_role;


-- ============================================================================
-- 3. MULTAS — só para quem tem obrigação e sob modo automático
-- ============================================================================

-- Aplica a multa vigente nas mensalidades vencidas e ainda pendentes do
-- associado. Idempotente: repetir no mesmo dia mantém o mesmo valor.
CREATE OR REPLACE FUNCTION public.aplica_multas_usuario(_usuario_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_valor numeric;
  v_auto  boolean;
  v_qtd   integer := 0;
BEGIN
  -- DIRETORIA É IMUNE.
  IF public.eh_diretoria(_usuario_id) THEN
    RETURN 0;
  END IF;

  -- Caso sob gestão manual da diretoria: não mexer.
  SELECT COALESCE(p.financeiro_automatico, true) INTO v_auto
    FROM public.perfis p WHERE p.id = _usuario_id;

  IF NOT COALESCE(v_auto, true) THEN
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


-- ============================================================================
-- 4. SITUAÇÃO FINANCEIRA — convidados ficam fora do motor
-- ============================================================================

-- Aplica multas + avalia suspensão (1 mês de atraso => INADIMPLENTE) e, nesse
-- caso, rebaixa o associado para convidado. Notifica na transição. Idempotente.
CREATE OR REPLACE FUNCTION public.atualiza_situacao_financeira(_usuario_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user  uuid := COALESCE(_usuario_id, auth.uid());
  v_atual text;
  v_auto  boolean;
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

  SELECT status_conta, financeiro_automatico INTO v_atual, v_auto
    FROM public.perfis
   WHERE id = v_user
   FOR UPDATE;

  IF NOT FOUND THEN
    PERFORM set_config('app.rotina_financeira', 'off', true);
    RETURN NULL;
  END IF;

  -- DIRETORIA É IMUNE: nunca recebe multa nem vira INADIMPLENTE.
  IF public.eh_diretoria(v_user) THEN
    IF v_atual IS DISTINCT FROM 'ATIVO' THEN
      UPDATE public.perfis SET status_conta = 'ATIVO' WHERE id = v_user;
    END IF;
    PERFORM set_config('app.rotina_financeira', 'off', true);
    RETURN 'ATIVO';
  END IF;

  -- CONVIDADOS (sem obrigação de mensalidade) ficam FORA do motor.
  -- Ex-associado suspenso segue como convidado e mantém o status INADIMPLENTE
  -- (e os débitos) até regularizar — mas não é mais reavaliado aqui.
  IF NOT public.eh_associado(v_user) THEN
    PERFORM set_config('app.rotina_financeira', 'off', true);
    RETURN v_atual;
  END IF;

  -- Gestão manual da diretoria: não mexer em nada.
  IF NOT COALESCE(v_auto, true) THEN
    PERFORM set_config('app.rotina_financeira', 'off', true);
    RETURN v_atual;
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
      -- Perde o cargo de associado e volta a ser convidado.
      PERFORM public.rebaixa_para_convidado(v_user);

      PERFORM public.notifica(
        v_user,
        'financeiro',
        'Associação suspensa por inadimplência',
        'Sua mensalidade está em aberto há mais de um mês. Sua associação foi suspensa e você voltou ao cargo de convidado. Para retomar, quite os débitos em aberto e a nova taxa de associação.',
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
-- multas + situação dos ASSOCIADOS (ignora diretoria, convidados e casos manuais).
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
       AND p.financeiro_automatico
       AND public.eh_associado(p.id)
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


-- ============================================================================
-- 5. CONSULTA (pendencias_financeiras) — inclui os novos estados
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pendencias_financeiras(_usuario_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user   uuid := COALESCE(_usuario_id, auth.uid());
  v_status text;
  v_diret  boolean;
  v_auto   boolean;
  v_assoc  boolean;
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

  SELECT COALESCE(p.status_conta, 'ATIVO'),
         public.eh_diretoria(v_user),
         COALESCE(p.financeiro_automatico, true),
         public.eh_associado(v_user)
    INTO v_status, v_diret, v_auto, v_assoc
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
    'usuarioId',           v_user,
    'statusConta',         COALESCE(v_status, 'ATIVO'),
    'ehDiretoria',         COALESCE(v_diret, false),
    'ehAssociado',         COALESCE(v_assoc, false),
    'financeiroAutomatico', COALESCE(v_auto, true),
    'mensalidades',        v_itens,
    'totalDebitos',        v_total,
    'valorMulta',          public.valor_multa_atraso(),
    'taxaAssociacao',      CASE WHEN v_status = 'INADIMPLENTE' THEN v_taxa ELSE 0 END,
    'totalRegularizacao',  CASE WHEN v_status = 'INADIMPLENTE' THEN v_total + v_taxa ELSE v_total END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.pendencias_financeiras(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pendencias_financeiras(uuid) TO authenticated, service_role;


-- ============================================================================
-- 6. REGULARIZAÇÃO PAGA — devolve o cargo e volta ao modo automático
-- ============================================================================

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

  -- Retoma o vínculo: ATIVO + cargo de associado + volta ao modo automático.
  UPDATE public.perfis
     SET status_conta = 'ATIVO',
         financeiro_automatico = true
   WHERE id = v_reg.usuario_id;

  IF NOT public.eh_diretoria(v_reg.usuario_id) THEN
    PERFORM public.promove_para_associado(v_reg.usuario_id);
  END IF;

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
-- 7. AÇÃO MANUAL DA DIRETORIA (autoridade livre, congela o automático)
-- ============================================================================

-- p_acao:
--   'suspender'  -> INADIMPLENTE + rebaixa para convidado + congela o caso
--   'reativar'   -> ATIVO + promove a associado + congela o caso
--   'automatico' -> devolve o caso ao motor automático e reavalia
CREATE OR REPLACE FUNCTION public.admin_definir_situacao_associado(
  p_usuario_id uuid,
  p_acao text
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_ref   date := date_trunc('month', now())::date;
BEGIN
  IF NOT public.eh_diretoria(v_admin) THEN
    RAISE EXCEPTION 'Somente a diretoria pode alterar a situação de um associado';
  END IF;

  IF public.eh_diretoria(p_usuario_id) THEN
    RAISE EXCEPTION 'A diretoria é imune ao sistema de inadimplência';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.perfis WHERE id = p_usuario_id) THEN
    RAISE EXCEPTION 'Perfil não encontrado';
  END IF;

  PERFORM set_config('app.rotina_financeira', 'on', true);

  IF p_acao = 'suspender' THEN
    UPDATE public.perfis
       SET status_conta = 'INADIMPLENTE',
           financeiro_automatico = false
     WHERE id = p_usuario_id;

    PERFORM public.rebaixa_para_convidado(p_usuario_id);

    PERFORM public.notifica(
      p_usuario_id,
      'financeiro',
      'Associação suspensa pela diretoria',
      'A diretoria suspendeu sua associação. Você voltou ao cargo de convidado. Fale com a diretoria para regularizar sua situação.',
      '/pagamentos'
    );

  ELSIF p_acao = 'reativar' THEN
    UPDATE public.perfis
       SET status_conta = 'ATIVO',
           financeiro_automatico = false
     WHERE id = p_usuario_id;

    PERFORM public.promove_para_associado(p_usuario_id);

    -- Garante a mensalidade do mês corrente para o associado reativado.
    INSERT INTO public.mensalidades (usuario_id, referencia, vencimento, valor)
    VALUES (p_usuario_id, v_ref, v_ref, public.valor_mensalidade())
    ON CONFLICT (usuario_id, referencia) DO NOTHING;

    PERFORM public.notifica(
      p_usuario_id,
      'financeiro',
      'Associação reativada pela diretoria',
      'A diretoria reativou sua associação. Você voltou ao cargo de associado.',
      '/pagamentos'
    );

  ELSIF p_acao = 'automatico' THEN
    UPDATE public.perfis
       SET financeiro_automatico = true
     WHERE id = p_usuario_id;

    PERFORM public.atualiza_situacao_financeira(p_usuario_id);

  ELSE
    RAISE EXCEPTION 'Ação inválida: use suspender, reativar ou automatico';
  END IF;

  PERFORM set_config('app.rotina_financeira', 'off', true);

  RETURN (SELECT status_conta FROM public.perfis WHERE id = p_usuario_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_definir_situacao_associado(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_definir_situacao_associado(uuid, text)
TO authenticated, service_role;


-- ============================================================================
-- 8. BACKFILL — rebaixa quem já estava INADIMPLENTE
-- ============================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.id
      FROM public.perfis p
     WHERE p.status_conta = 'INADIMPLENTE'
       AND NOT public.eh_diretoria(p.id)
       AND public.eh_associado(p.id)
  LOOP
    PERFORM public.rebaixa_para_convidado(r.id);
  END LOOP;
END $$;


-- ============================================================================
-- VERIFICAÇÕES (INFORMATIVAS)
-- ============================================================================
-- SELECT p.nome, p.status_conta, p.financeiro_automatico,
--        public.eh_associado(p.id) AS eh_associado,
--        public.eh_diretoria(p.id) AS eh_diretoria
--   FROM public.perfis p
--  ORDER BY p.status_conta DESC, p.nome;
--
-- SELECT user_id, papel FROM public.papeis_usuario ORDER BY user_id;
-- ============================================================================
