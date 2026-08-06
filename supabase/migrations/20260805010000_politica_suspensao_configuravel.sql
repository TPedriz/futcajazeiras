-- ============================================================
-- Política de suspensões 100% configurável pela diretoria.
-- Parâmetros em public.configuracoes (ajustáveis no painel):
--   limite_faltas            = nº de faltas para suspender        (padrão 3)
--   janela_faltas            = nº de babas recentes considerados  (padrão 5)
--   suspensao_faltas_babas   = duração da suspensão por faltas    (padrão 1; 0 = desliga)
--   suspensao_vermelho_babas = duração da suspensão por vermelho  (padrão 1; 0 = desliga)
-- ============================================================

-- 1. Coluna de origem (idempotente; já criada pela migration anterior se aplicada).
ALTER TABLE public.suspensoes
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'diretoria';

-- 2. Parâmetros padrão da política.
INSERT INTO public.configuracoes (chave, valor) VALUES
  ('limite_faltas', 3),
  ('janela_faltas', 5),
  ('suspensao_faltas_babas', 1),
  ('suspensao_vermelho_babas', 1)
ON CONFLICT (chave) DO NOTHING;

-- 3. Leitor de configuração inteira com fallback.
CREATE OR REPLACE FUNCTION public.config_int(_chave text, _padrao integer)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT valor::integer FROM public.configuracoes WHERE chave = _chave), _padrao);
$$;
REVOKE ALL ON FUNCTION public.config_int(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.config_int(text, integer) TO authenticated, service_role;

-- 4. Permite suspender vários babas a partir da mesma origem (duração configurável).
ALTER TABLE public.suspensoes DROP CONSTRAINT IF EXISTS suspensoes_usuario_id_baba_origem_id_key;
ALTER TABLE public.suspensoes ADD CONSTRAINT suspensoes_usuario_id_baba_origem_id_baba_bloqueado_id_key
  UNIQUE (usuario_id, baba_origem_id, baba_bloqueado_id);

-- 5. Helper: cria suspensões para os próximos N babas. Quantidade 0 = desliga (retorna 0).
CREATE OR REPLACE FUNCTION public.aplica_suspensao(
  _usuario_id uuid,
  _origem_baba uuid,
  _motivo text,
  _origem text,
  _quantidade integer
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b record;
  v_criadas integer := 0;
BEGIN
  IF _quantidade IS NULL OR _quantidade < 1 THEN
    RETURN 0;
  END IF;
  FOR b IN
    SELECT id FROM public.sessoes_baba
    WHERE data_horario > now()
    ORDER BY data_horario ASC
    LIMIT _quantidade
  LOOP
    INSERT INTO public.suspensoes (usuario_id, baba_origem_id, baba_bloqueado_id, motivo, origem)
    VALUES (_usuario_id, _origem_baba, b.id, _motivo, _origem)
    ON CONFLICT (usuario_id, baba_origem_id, baba_bloqueado_id) DO NOTHING;
    IF FOUND THEN
      v_criadas := v_criadas + 1;
    END IF;
  END LOOP;
  RETURN v_criadas;
END;
$$;
REVOKE ALL ON FUNCTION public.aplica_suspensao(uuid, uuid, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplica_suspensao(uuid, uuid, text, text, integer) TO service_role;

-- 6. Cartão vermelho com duração configurável.
CREATE OR REPLACE FUNCTION public.aplica_suspensao_vermelho()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  data_origem timestamptz;
  v_qtd integer;
  v_criadas integer;
BEGIN
  IF NEW.cartoes_vermelhos > COALESCE(OLD.cartoes_vermelhos, 0) THEN
    SELECT data_horario INTO data_origem FROM public.sessoes_baba WHERE id = NEW.baba_id;
    v_qtd := public.config_int('suspensao_vermelho_babas', 1);
    v_criadas := public.aplica_suspensao(
      NEW.usuario_id,
      NEW.baba_id,
      'Suspenso por cartão vermelho no baba do dia ' || to_char(data_origem AT TIME ZONE 'America/Fortaleza', 'DD/MM/YYYY'),
      'cartao_vermelho',
      v_qtd
    );
    IF v_criadas > 0 THEN
      PERFORM public.notifica(NEW.usuario_id, 'suspensao', 'Suspensão por cartão vermelho',
        'Você recebeu cartão vermelho no baba do dia ' ||
        to_char(data_origem AT TIME ZONE 'America/Fortaleza', 'DD/MM/YYYY') ||
        ' e está suspenso ' ||
        CASE WHEN v_qtd > 1 THEN 'dos próximos ' || v_qtd || ' babas.' ELSE 'do próximo baba.' END);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 7. Faltas com limite, janela e duração configuráveis (associados apenas).
CREATE OR REPLACE FUNCTION public.aplica_suspensao_faltas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_data timestamptz;
  v_faltas integer;
  v_janela integer;
  v_limite integer;
  v_qtd integer;
  v_criadas integer;
BEGIN
  -- Falta marcada: compareceu mudou para FALSE
  IF NEW.compareceu IS FALSE AND OLD.compareceu IS DISTINCT FROM FALSE THEN
    v_limite := public.config_int('limite_faltas', 3);
    v_janela := public.config_int('janela_faltas', 5);
    v_qtd := public.config_int('suspensao_faltas_babas', 1);

    SELECT data_horario INTO v_data FROM public.sessoes_baba WHERE id = NEW.baba_id;
    IF v_data IS NULL THEN
      RAISE EXCEPTION 'Baba da presença não encontrado';
    END IF;

    -- Conta as faltas do usuário (compareceu = false) nos últimos v_janela babas até o atual
    SELECT COUNT(*)::int INTO v_faltas
    FROM public.presencas p
    JOIN public.sessoes_baba s ON s.id = p.baba_id
    WHERE p.usuario_id = NEW.usuario_id
      AND p.nome_convidado IS NULL
      AND p.compareceu IS FALSE
      AND s.data_horario <= v_data
      AND s.id IN (
        SELECT id FROM public.sessoes_baba
        WHERE data_horario <= v_data
        ORDER BY data_horario DESC
        LIMIT v_janela
      );

    IF v_faltas >= v_limite THEN
      v_criadas := public.aplica_suspensao(
        NEW.usuario_id,
        NEW.baba_id,
        'Suspenso por ' || v_faltas || ' faltas nos últimos ' || v_janela || ' babas.',
        'faltas',
        v_qtd
      );
      IF v_criadas > 0 THEN
        PERFORM public.notifica(NEW.usuario_id, 'suspensao', 'Suspensão por faltas',
          'Você acumulou ' || v_faltas || ' faltas e está suspenso ' ||
          CASE WHEN v_qtd > 1 THEN 'dos próximos ' || v_qtd || ' babas.' ELSE 'do próximo baba.' END ||
          ' Fale com a diretoria se foi um engano.');
      END IF;
    END IF;
  END IF;

  -- Falta desfeita (compareceu saiu de FALSE): remove as suspensões automáticas de faltas deste baba
  IF OLD.compareceu IS FALSE AND NEW.compareceu IS DISTINCT FROM FALSE THEN
    DELETE FROM public.suspensoes
    WHERE usuario_id = NEW.usuario_id
      AND baba_origem_id = NEW.baba_id
      AND origem = 'faltas';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_suspensao_faltas ON public.presencas;
CREATE TRIGGER trg_suspensao_faltas
AFTER INSERT OR UPDATE OF compareceu ON public.presencas
FOR EACH ROW EXECUTE FUNCTION public.aplica_suspensao_faltas();
