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
