-- ============================================================
-- Fut Cajazeiras — BAxVI: relacionados (escalação), cartões zerados
-- no clássico e conquistas exclusivas do BAxVI.
-- ------------------------------------------------------------
-- O que faz:
--   1. Tabela `bavi_relacionados`: a diretoria seleciona os
--      associados de cada time (Bahia / Vitória) antes do jogo,
--      como a lista de relacionados do Brasileirão. Os times são
--      salvos a partir dela (times_baba / times_jogadores) para
--      lançar resultados e estatísticas.
--   2. Cartões zerados no BAxVI: amarelos e vermelhos lançados num
--      clássico não contam para a janela de suspensão dos babas
--      comuns (cada BAxVI começa do zero).
--   3. Conquistas exclusivas do BAxVI (participação, vitórias,
--      gols e assistências no clássico) + reavaliação automática.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabela de relacionados do BAxVI
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bavi_relacionados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baba_id uuid NOT NULL REFERENCES public.sessoes_baba(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  time_nome text NOT NULL,
  posicao public.posicao_jogador NOT NULL DEFAULT 'linha',
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bavi_relacionados_time_nome_check CHECK (time_nome IN ('bahia', 'vitoria')),
  CONSTRAINT bavi_relacionados_unico UNIQUE (baba_id, usuario_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bavi_relacionados TO authenticated;
GRANT ALL ON public.bavi_relacionados TO service_role;
ALTER TABLE public.bavi_relacionados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos leem relacionados do BAxVI" ON public.bavi_relacionados;
CREATE POLICY "Todos leem relacionados do BAxVI" ON public.bavi_relacionados
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin gerencia relacionados do BAxVI" ON public.bavi_relacionados;
CREATE POLICY "Admin gerencia relacionados do BAxVI" ON public.bavi_relacionados
  FOR ALL TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

-- ------------------------------------------------------------
-- 2) Cartões zerados no BAxVI — janela de amarelos ignora clássicos
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aplica_suspensao_amarelos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_janela integer;
  v_limite integer;
  v_qtd integer;
  v_amarelos integer;
  v_criadas integer;
  v_tipo text;
BEGIN
  -- Só dispara quando o nº de amarelos AUMENTA (novo cartão no baba).
  IF NEW.cartoes_amarelos <= COALESCE(OLD.cartoes_amarelos, 0) THEN
    RETURN NEW;
  END IF;

  -- No BAxVI os cartões são zerados a cada clássico: não entram na janela
  -- de amarelos dos babas comuns nem geram suspensão.
  SELECT tipo INTO v_tipo FROM public.sessoes_baba WHERE id = NEW.baba_id;
  IF v_tipo = 'baxvi' THEN
    RETURN NEW;
  END IF;

  v_janela := public.config_int('janela_amarelos', 5);
  v_limite := public.config_int('limite_amarelos', 3);
  v_qtd    := public.config_int('suspensao_amarelos_babas', 1);
  IF v_limite < 1 OR v_qtd < 1 THEN
    RETURN NEW;
  END IF;

  -- Conta os amarelos do usuário nos últimos v_janela babas COMUNS
  -- (até o baba atual), ignorando BAxVIs.
  SELECT COALESCE(SUM(e.cartoes_amarelos), 0)::int INTO v_amarelos
  FROM public.estatisticas_baba e
  JOIN public.sessoes_baba s ON s.id = e.baba_id
  WHERE e.usuario_id = NEW.usuario_id
    AND s.tipo IS DISTINCT FROM 'baxvi'
    AND s.data_horario <= (SELECT data_horario FROM public.sessoes_baba WHERE id = NEW.baba_id)
    AND s.id IN (
      SELECT id FROM public.sessoes_baba
      WHERE tipo IS DISTINCT FROM 'baxvi'
        AND data_horario <= (SELECT data_horario FROM public.sessoes_baba WHERE id = NEW.baba_id)
      ORDER BY data_horario DESC
      LIMIT v_janela
    );

  IF v_amarelos >= v_limite THEN
    v_criadas := public.aplica_suspensao(
      NEW.usuario_id, NEW.baba_id,
      'Suspenso por ' || v_amarelos || ' cartões amarelos nos últimos ' || v_janela || ' babas.',
      'cartao_amarelo', v_qtd
    );
    IF v_criadas > 0 THEN
      PERFORM public.notifica(NEW.usuario_id, 'suspensao', 'Suspensão por cartões amarelos',
        'Você acumulou ' || v_amarelos || ' cartões amarelos em ' || v_janela || ' babas e está suspenso ' ||
        CASE WHEN v_qtd > 1 THEN 'dos próximos ' || v_qtd || ' babas.' ELSE 'do próximo baba.' END);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- 3) Cartões zerados no BAxVI — vermelho não gera suspensão comum
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aplica_suspensao_vermelho()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  data_origem timestamptz;
  v_tipo text;
  v_qtd integer;
  v_criadas integer;
BEGIN
  IF NEW.cartoes_vermelhos > COALESCE(OLD.cartoes_vermelhos, 0) THEN
    SELECT data_horario, tipo INTO data_origem, v_tipo FROM public.sessoes_baba WHERE id = NEW.baba_id;

    -- Vermelho no BAxVI fica zerado no clássico: não suspende dos babas comuns.
    IF v_tipo = 'baxvi' THEN
      RETURN NEW;
    END IF;

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

-- ------------------------------------------------------------
-- 4) Conquistas exclusivas do BAxVI
-- ------------------------------------------------------------
INSERT INTO public.conquistas (codigo, nome, descricao, icone, cor, categoria, meta) VALUES
  ('bavi_1', 'Estreia no Clássico', 'Seja relacionado para o seu primeiro BAxVI.', '⚔️', 'gold', 'bavi_presenca', 1),
  ('bavi_3', 'Frequência de Clássico', 'Seja relacionado em 3 BAxVIs.', '🏟️', 'gold', 'bavi_presenca', 3),
  ('bavi_5', 'Lenda do BAxVI', 'Seja relacionado em 5 BAxVIs.', '👑', 'gold', 'bavi_presenca', 5),
  ('bavi_vitoria_1', 'Ganhou o Clássico', 'Vença um BAxVI.', '🏆', 'amber', 'bavi_vitorias', 1),
  ('bavi_vitorias_3', 'Rei do Clássico', 'Vença 3 BAxVIs.', '⚔️', 'amber', 'bavi_vitorias', 3),
  ('bavi_gol_1', 'Gol no Clássico', 'Marque um gol em um BAxVI.', '🎯', 'sky', 'bavi_gols', 1),
  ('bavi_gols_3', 'Artilheiro do Clássico', 'Marque 3 gols em BAxVIs.', '🔥', 'sky', 'bavi_gols', 3),
  ('bavi_assistencia_1', 'Garçom do Clássico', 'Dê uma assistência em um BAxVI.', '🅰️', 'violet', 'bavi_assistencias', 1)
ON CONFLICT (codigo) DO NOTHING;

-- ------------------------------------------------------------
-- 5) verifica_conquistas estendido com estatísticas do BAxVI
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.verifica_conquistas(usuario uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_presencas integer;
  v_gols integer;
  v_assistencias integer;
  v_penaltis integer;
  v_amarelos integer;
  v_faltas integer;
  v_gc integer;
  v_vitorias integer;
  v_xp integer;
  v_nivel integer;
  v_bavi_participacoes integer;
  v_bavi_vitorias integer;
  v_bavi_gols integer;
  v_bavi_assistencias integer;
  c record;
BEGIN
  IF usuario IS NULL THEN
    RETURN;
  END IF;

  -- Presenças do próprio jogador + como convidado.
  SELECT COUNT(*) INTO v_presencas
    FROM public.presencas
    WHERE compareceu IS TRUE
      AND ((usuario_id = usuario AND nome_convidado IS NULL) OR convidado_user_id = usuario);

  SELECT COALESCE(SUM(gols), 0), COALESCE(SUM(assistencias), 0),
         COALESCE(SUM(penaltis_defendidos), 0),
         COALESCE(SUM(cartoes_amarelos), 0),
         COALESCE(SUM(faltas), 0),
         COALESCE(SUM(gols_contra), 0)
    INTO v_gols, v_assistencias, v_penaltis, v_amarelos, v_faltas, v_gc
    FROM public.estatisticas_baba WHERE usuario_id = usuario;

  SELECT COUNT(*) INTO v_vitorias
    FROM public.times_jogadores tj
    JOIN public.times_baba t ON t.id = tj.time_id
    WHERE tj.usuario_id = usuario AND t.resultado = 'vitoria';

  -- BAxVI: participações, vitórias, gols e assistências só nos clássicos.
  SELECT COUNT(*) INTO v_bavi_participacoes
    FROM public.times_jogadores tj
    JOIN public.times_baba t ON t.id = tj.time_id
    JOIN public.sessoes_baba s ON s.id = t.baba_id
    WHERE tj.usuario_id = usuario AND s.tipo = 'baxvi';

  SELECT COUNT(*) INTO v_bavi_vitorias
    FROM public.times_jogadores tj
    JOIN public.times_baba t ON t.id = tj.time_id
    JOIN public.sessoes_baba s ON s.id = t.baba_id
    WHERE tj.usuario_id = usuario AND t.resultado = 'vitoria' AND s.tipo = 'baxvi';

  SELECT COALESCE(SUM(e.gols), 0), COALESCE(SUM(e.assistencias), 0)
    INTO v_bavi_gols, v_bavi_assistencias
    FROM public.estatisticas_baba e
    JOIN public.sessoes_baba s ON s.id = e.baba_id
    WHERE e.usuario_id = usuario AND s.tipo = 'baxvi';

  SELECT xp_atual, nivel_atual INTO v_xp, v_nivel
    FROM public.perfis WHERE id = usuario;

  FOR c IN SELECT * FROM public.conquistas LOOP
    IF c.categoria = 'presenca' AND v_presencas >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'gols' AND v_gols >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'assistencias' AND v_assistencias >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'penaltis' AND v_penaltis >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'vitorias' AND v_vitorias >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'cartoes' AND v_amarelos >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'faltas' AND v_faltas >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'gols_contra' AND v_gc >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'bavi_presenca' AND v_bavi_participacoes >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'bavi_vitorias' AND v_bavi_vitorias >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'bavi_gols' AND v_bavi_gols >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'bavi_assistencias' AND v_bavi_assistencias >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'nivel' AND v_nivel >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'xp' AND v_xp >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    END IF;
  END LOOP;
END;
$$;

-- ------------------------------------------------------------
-- 6) Reavalia conquistas do BAxVI quando times/jogadores mudam
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reavalia_conquistas_times()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_baba uuid;
BEGIN
  IF TG_TABLE_NAME = 'times_jogadores' THEN
    IF COALESCE(NEW.usuario_id, OLD.usuario_id) IS NOT NULL THEN
      PERFORM public.verifica_conquistas(COALESCE(NEW.usuario_id, OLD.usuario_id));
    END IF;
  ELSIF TG_TABLE_NAME = 'times_baba' THEN
    v_baba := COALESCE(NEW.baba_id, OLD.baba_id);
    PERFORM public.verifica_conquistas(tj.usuario_id)
      FROM public.times_jogadores tj
      JOIN public.times_baba t ON t.id = tj.time_id
      WHERE t.baba_id = v_baba AND tj.usuario_id IS NOT NULL;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_conquistas_times_baba ON public.times_baba;
CREATE TRIGGER trg_conquistas_times_baba
  AFTER INSERT OR UPDATE OF resultado OR DELETE ON public.times_baba
  FOR EACH ROW EXECUTE FUNCTION public.reavalia_conquistas_times();

DROP TRIGGER IF EXISTS trg_conquistas_times_jogadores ON public.times_jogadores;
CREATE TRIGGER trg_conquistas_times_jogadores
  AFTER INSERT OR UPDATE OF usuario_id OR DELETE ON public.times_jogadores
  FOR EACH ROW EXECUTE FUNCTION public.reavalia_conquistas_times();

-- ------------------------------------------------------------
-- 7) Backfill: reavalia as conquistas de todos os jogadores
-- ------------------------------------------------------------
SELECT public.verifica_conquistas(id) FROM public.perfis;

-- ------------------------------------------------------------
-- 8) BAxVI: apenas os relacionados confirmam presença e check-in
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.valida_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  ref date := date_trunc('month', now())::date;
  venc date := (date_trunc('month', now()) + INTERVAL '9 days')::date;
  esta_pago boolean;
  eh_associado boolean;
  esta_ativo boolean;
  ses public.sessoes_baba%ROWTYPE;
BEGIN
  SELECT p.ativo INTO esta_ativo FROM public.perfis p WHERE p.id = NEW.usuario_id;
  IF COALESCE(esta_ativo, true) = false THEN
    RAISE EXCEPTION 'Conta desativada. Fale com a diretoria.';
  END IF;

  IF auth.uid() IS DISTINCT FROM NEW.usuario_id THEN RETURN NEW; END IF;

  SELECT * INTO ses FROM public.sessoes_baba WHERE id = NEW.baba_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Baba não encontrado.'; END IF;

  IF ses.esta_fechado THEN
    RAISE EXCEPTION 'A lista foi fechada pela diretoria.';
  END IF;
  IF now() < COALESCE(ses.abertura_lista, '1970-01-01'::timestamptz) THEN
    RAISE EXCEPTION 'A lista ainda não foi aberta para check-in.';
  END IF;
  IF now() >= COALESCE(ses.fechamento_lista, '9999-12-31'::timestamptz) THEN
    RAISE EXCEPTION 'A lista já foi encerrada.';
  END IF;

  IF NEW.nome_convidado IS NOT NULL THEN RETURN NEW; END IF;

  -- No BAxVI, apenas os relacionados do clássico entram na lista (a diretoria pode adicionar).
  IF ses.tipo = 'baxvi' AND NOT public.tem_papel(auth.uid(), 'administrador') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.bavi_relacionados
      WHERE baba_id = NEW.baba_id AND usuario_id = NEW.usuario_id
    ) THEN
      RAISE EXCEPTION 'Você não está relacionado para este BAxVI. Apenas os relacionados confirmam presença e fazem check-in.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.suspensoes s
    WHERE s.usuario_id = NEW.usuario_id AND s.baba_bloqueado_id = NEW.baba_id
  ) THEN
    RAISE EXCEPTION 'Você está suspenso por cartão vermelho e não pode entrar na lista deste baba.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.papeis_usuario pu
    WHERE pu.user_id = NEW.usuario_id AND pu.papel IN ('associado','administrador')
  ) INTO eh_associado;

  IF eh_associado AND now()::date > venc THEN
    SELECT (m.status = 'pago') INTO esta_pago
      FROM public.mensalidades m
      WHERE m.usuario_id = NEW.usuario_id AND m.referencia = ref;
    IF COALESCE(esta_pago, false) = false THEN
      RAISE EXCEPTION 'Mensalidade em aberto desde o dia 10. Pague o PIX para liberar seu check-in.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Check-in por GPS: no BAxVI, só relacionado (diretoria sempre pode).
CREATE OR REPLACE FUNCTION public.marcar_chegada(_presenca_id uuid, _lat double precision, _lng double precision)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pres public.presencas%ROWTYPE;
  ses public.sessoes_baba%ROWTYPE;
  dist double precision;
  abertura timestamptz;
  limite timestamptz;
  prox integer;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO pres FROM public.presencas WHERE id = _presenca_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Presença não encontrada'; END IF;

  IF auth.uid() <> pres.usuario_id
     AND auth.uid() IS DISTINCT FROM pres.convidado_user_id
     AND NOT public.tem_papel(auth.uid(), 'administrador') THEN
    RAISE EXCEPTION 'Você não pode marcar a chegada de outra pessoa';
  END IF;

  SELECT * INTO ses FROM public.sessoes_baba WHERE id = pres.baba_id;

  -- No BAxVI, apenas os relacionados do clássico fazem check-in.
  IF ses.tipo = 'baxvi' AND NOT public.tem_papel(auth.uid(), 'administrador') THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.bavi_relacionados
      WHERE baba_id = pres.baba_id AND usuario_id = pres.usuario_id
    ) THEN
      RAISE EXCEPTION 'Apenas os relacionados do BAxVI podem fazer check-in.';
    END IF;
  END IF;

  abertura := ses.data_horario - INTERVAL '30 minutes';
  limite := ses.data_horario + INTERVAL '1 hour';

  IF NOT public.tem_papel(auth.uid(), 'administrador') THEN
    IF now() < abertura THEN
      RAISE EXCEPTION 'A marcação de chegada abre 30 minutos antes do baba.';
    END IF;
    IF now() > limite THEN
      RAISE EXCEPTION 'A marcação de chegada encerrou 1 hora após o início do baba.';
    END IF;

    dist := 6371000 * acos(
      least(1, greatest(-1,
        cos(radians(ses.latitude)) * cos(radians(_lat)) * cos(radians(_lng) - radians(ses.longitude))
        + sin(radians(ses.latitude)) * sin(radians(_lat))
      ))
    );
    IF dist > ses.raio_metros THEN
      RAISE EXCEPTION 'Você precisa estar na arena ou a menos de 1km de distância para marcar sua chegada.';
    END IF;
  END IF;

  IF pres.ordem_chegada IS NOT NULL THEN RETURN pres.ordem_chegada; END IF;

  SELECT COALESCE(MAX(ordem_chegada), 0) + 1 INTO prox
    FROM public.presencas WHERE baba_id = pres.baba_id;

  UPDATE public.presencas
     SET chegou_em = now(), ordem_chegada = prox, compareceu = true
   WHERE id = _presenca_id;

  RETURN prox;
END;
$$;
