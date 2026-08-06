-- ============================================================
-- Política de suspensão automática por faltas
-- A diretoria marca falta (compareceu = false) na lista de presença.
-- Ao acumular 3 faltas nos últimos 5 babas, o jogador é suspenso
-- automaticamente do próximo baba e notificado.
-- Desfazer a falta remove a suspensão automática daquele baba.
-- ============================================================

-- 1. Origem da suspensão: 'diretoria' (manual) | 'cartao_vermelho' | 'faltas'
ALTER TABLE public.suspensoes
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'diretoria';

-- 2. Atualiza a suspensão por cartão vermelho para marcar a origem.
CREATE OR REPLACE FUNCTION public.aplica_suspensao_vermelho()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  prox uuid;
  data_origem timestamptz;
  nova_susp uuid;
BEGIN
  IF NEW.cartoes_vermelhos > COALESCE(OLD.cartoes_vermelhos, 0) THEN
    SELECT data_horario INTO data_origem FROM public.sessoes_baba WHERE id = NEW.baba_id;
    SELECT id INTO prox FROM public.sessoes_baba
      WHERE data_horario > data_origem ORDER BY data_horario ASC LIMIT 1;
    INSERT INTO public.suspensoes (usuario_id, baba_origem_id, baba_bloqueado_id, motivo, origem)
    VALUES (NEW.usuario_id, NEW.baba_id, prox,
      'Suspenso por cartão vermelho no baba do dia ' || to_char(data_origem AT TIME ZONE 'America/Fortaleza', 'DD/MM/YYYY'),
      'cartao_vermelho')
    ON CONFLICT (usuario_id, baba_origem_id) DO NOTHING
    RETURNING id INTO nova_susp;

    IF nova_susp IS NOT NULL THEN
      PERFORM public.notifica(NEW.usuario_id, 'suspensao', 'Suspensão por cartão vermelho',
        'Você recebeu cartão vermelho no baba do dia ' ||
        to_char(data_origem AT TIME ZONE 'America/Fortaleza', 'DD/MM/YYYY') ||
        ' e está suspenso do próximo baba.');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3. Suspensão automática por faltas (associados apenas).
CREATE OR REPLACE FUNCTION public.aplica_suspensao_faltas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_data timestamptz;
  v_faltas integer;
  v_janela integer := 5;   -- últimos N babas considerados
  v_limite integer := 3;   -- N faltas para suspender
  v_prox uuid;
  v_nova uuid;
BEGIN
  -- Falta marcada: compareceu mudou para FALSE
  IF NEW.compareceu IS FALSE AND OLD.compareceu IS DISTINCT FROM FALSE THEN
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
      -- Próximo baba após agora (garante suspensão futura)
      SELECT id INTO v_prox FROM public.sessoes_baba
        WHERE data_horario > now()
        ORDER BY data_horario ASC LIMIT 1;

      IF v_prox IS NOT NULL THEN
        INSERT INTO public.suspensoes (usuario_id, baba_origem_id, baba_bloqueado_id, motivo, origem)
        VALUES (
          NEW.usuario_id,
          NEW.baba_id,
          v_prox,
          'Suspenso por ' || v_faltas || ' faltas nos últimos ' || v_janela || ' babas.',
          'faltas'
        )
        ON CONFLICT (usuario_id, baba_origem_id) DO NOTHING
        RETURNING id INTO v_nova;

        IF v_nova IS NOT NULL THEN
          PERFORM public.notifica(NEW.usuario_id, 'suspensao', 'Suspensão por faltas',
            'Você acumulou ' || v_faltas || ' faltas e está suspenso do próximo baba. Fale com a diretoria se foi um engano.');
        END IF;
      END IF;
    END IF;
  END IF;

  -- Falta desfeita (compareceu saiu de FALSE): remove a suspensão automática gerada por faltas deste baba
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
