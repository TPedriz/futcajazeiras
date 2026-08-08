-- =====================================================================
-- Novas estatísticas: Faltas cometidas e Gols contra
-- + Gamificação mais leve (subir de nível mais fácil) e bolha de conquista.
-- =====================================================================

-- ============ 1) Novas colunas em estatisticas_baba ============
ALTER TABLE public.estatisticas_baba
  ADD COLUMN IF NOT EXISTS faltas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gols_contra integer NOT NULL DEFAULT 0;

-- ============ 2) XP mais fácil: aumenta o ganho por evento ============
-- Presença confirmada: +10 -> +15 XP
CREATE OR REPLACE FUNCTION public.ganho_xp_presenca()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_jogador uuid;
BEGIN
  IF NEW.compareceu IS TRUE AND (TG_OP = 'INSERT' OR OLD.compareceu IS DISTINCT FROM TRUE) THEN
    v_jogador := CASE
      WHEN NEW.nome_convidado IS NOT NULL THEN NEW.convidado_user_id
      ELSE NEW.usuario_id
    END;
    IF v_jogador IS NOT NULL THEN
      PERFORM public.concede_xp(v_jogador, 15);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Gol: +5 -> +8 XP • Assistência: +3 -> +5 XP
CREATE OR REPLACE FUNCTION public.ganho_xp_estatisticas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_gols integer;
  v_assists integer;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_gols := NEW.gols;
    v_assists := NEW.assistencias;
  ELSE
    v_gols := GREATEST(NEW.gols - OLD.gols, 0);
    v_assists := GREATEST(NEW.assistencias - OLD.assistencias, 0);
  END IF;

  IF NEW.usuario_id IS NOT NULL AND (v_gols > 0 OR v_assists > 0) THEN
    PERFORM public.concede_xp(NEW.usuario_id, v_gols * 8 + v_assists * 5);
  END IF;
  RETURN NEW;
END;
$$;

-- ============ 3) Curva de nível mais suave: 100 -> 75 por passo ============
-- Antes: nível 2 = 100, 3 = 300, 4 = 600, 5 = 1000...
-- Agora:  nível 2 = 75,  3 = 225, 4 = 450, 5 = 750...
CREATE OR REPLACE FUNCTION public.xp_necessaria_para_nivel(nivel integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT 75 * nivel * (nivel - 1) / 2;
$$;

CREATE OR REPLACE FUNCTION public.nivel_para_xp(xp integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT floor((1 + sqrt(1 + 8.0 * GREATEST(xp, 0) / 75)) / 2)::integer;
$$;

-- Recalcula o nível de quem já tem XP (a curva nova vale de imediato).
UPDATE public.perfis
   SET nivel_atual = public.nivel_para_xp(xp_atual)
 WHERE xp_atual > 0 AND nivel_atual <> public.nivel_para_xp(xp_atual);

-- ============ 4) Bolha de nível: notifica quando o jogador sobe de nível ============
CREATE OR REPLACE FUNCTION public.concede_xp(usuario uuid, quantidade integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_novo_xp integer;
  v_antigo_nivel integer;
  v_novo_nivel integer;
BEGIN
  IF usuario IS NULL OR quantidade IS NULL OR quantidade <= 0 THEN
    RETURN 0;
  END IF;

  SELECT nivel_atual INTO v_antigo_nivel FROM public.perfis WHERE id = usuario;
  v_antigo_nivel := COALESCE(v_antigo_nivel, 1);

  UPDATE public.perfis
  SET xp_atual = xp_atual + quantidade,
      nivel_atual = public.nivel_para_xp(xp_atual + quantidade),
      atualizado_em = now()
  WHERE id = usuario
  RETURNING xp_atual, nivel_atual INTO v_novo_xp, v_novo_nivel;

  IF v_novo_xp IS NOT NULL THEN
    PERFORM public.verifica_conquistas(usuario);
    IF v_novo_nivel IS NOT NULL AND v_novo_nivel > v_antigo_nivel THEN
      PERFORM public.notifica(usuario, 'nivel', 'Nível ' || v_novo_nivel || ' alcançado!',
        'Você subiu para o nível ' || v_novo_nivel ||
        '. Quanto maior o nível, maior o bônus no OVR da sua cartinha (até +5).');
    END IF;
  END IF;
  RETURN v_novo_xp;
END;
$$;

-- ============ 5) Cartinha: faltas e gols contra penalizam DEF/FÍS ============
CREATE OR REPLACE FUNCTION public.calcula_cartinha(usuario uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_babas_total integer;
  v_presencas integer;
  v_gols integer;
  v_assists integer;
  v_penaltis integer;
  v_ca integer;
  v_caz integer;
  v_cv integer;
  v_faltas integer;
  v_gc integer;
  v_vitorias integer;
  v_nivel integer;
  v_posicao public.posicao_jogador;
  v_freq numeric;
  v_base integer;
  v_pac integer;
  v_sho integer;
  v_pas integer;
  v_dri integer;
  v_def integer;
  v_phy integer;
  v_ovr integer;
  v_bonus integer;
  v_tema text;
BEGIN
  IF usuario IS NULL THEN
    RETURN;
  END IF;

  SELECT nivel_atual, posicao INTO v_nivel, v_posicao
    FROM public.perfis WHERE id = usuario;
  v_nivel := COALESCE(v_nivel, 1);
  v_posicao := COALESCE(v_posicao, 'linha');

  -- Total de babas já realizados (denominador da frequência).
  SELECT COUNT(*) INTO v_babas_total
    FROM public.sessoes_baba WHERE data_horario <= now();

  -- Presenças confirmadas (compareceu = true): própria + como convidado.
  SELECT COUNT(*) INTO v_presencas
    FROM public.presencas
    WHERE compareceu IS TRUE
      AND ((usuario_id = usuario AND nome_convidado IS NULL) OR convidado_user_id = usuario);

  -- Estatísticas acumuladas do baba.
  SELECT COALESCE(SUM(gols), 0), COALESCE(SUM(assistencias), 0),
         COALESCE(SUM(penaltis_defendidos), 0),
         COALESCE(SUM(cartoes_amarelos), 0),
         COALESCE(SUM(cartoes_azuis), 0),
         COALESCE(SUM(cartoes_vermelhos), 0),
         COALESCE(SUM(faltas), 0),
         COALESCE(SUM(gols_contra), 0)
    INTO v_gols, v_assists, v_penaltis, v_ca, v_caz, v_cv, v_faltas, v_gc
    FROM public.estatisticas_baba WHERE usuario_id = usuario;

  -- Vitórias nos times sorteados.
  SELECT COUNT(*) INTO v_vitorias
    FROM public.times_jogadores tj
    JOIN public.times_baba t ON t.id = tj.time_id
    WHERE tj.usuario_id = usuario AND t.resultado = 'vitoria';

  v_freq := CASE WHEN v_babas_total > 0
    THEN LEAST(1.0, v_presencas::numeric / v_babas_total) ELSE 0 END;

  -- PAC (Ritmo/Presença): frequência nos babas.
  v_pac := LEAST(99, GREATEST(1, 40 + round(v_freq * 59)));

  -- SHO (Finalização): média de gols por baba disputado.
  v_sho := LEAST(99, GREATEST(1, 40 + round(
    CASE WHEN v_presencas > 0 THEN (v_gols::numeric / v_presencas) * 15 ELSE 0 END)));

  -- PAS (Passe): média de assistências por baba disputado.
  v_pas := LEAST(99, GREATEST(1, 40 + round(
    CASE WHEN v_presencas > 0 THEN (v_assists::numeric / v_presencas) * 15 ELSE 0 END)));

  -- DRI (Drible): vitórias por baba + leve bônus por gols.
  v_dri := LEAST(99, GREATEST(1, 40 + round(
    CASE WHEN v_presencas > 0
      THEN (v_vitorias::numeric / v_presencas) * 12 + (v_gols::numeric / v_presencas) * 3
      ELSE 0 END)));

  -- DEF (Defesa/Disciplina): vitórias por baba com desconto por cartões,
  -- faltas cometidas e gols contra.
  v_def := LEAST(99, GREATEST(1, 40 + round(
    CASE WHEN v_presencas > 0 THEN (v_vitorias::numeric / v_presencas) * 10 ELSE 0 END)
    - v_ca * 2 - v_caz * 3 - v_cv * 6 - v_faltas * 1 - v_gc * 3));

  -- PHY (Físico): pênaltis defendidos + bônus de goleiro + nível de XP,
  -- com pequeno desconto por faltas cometidas.
  v_phy := LEAST(99, GREATEST(1,
    40 + v_penaltis * 8
      + CASE WHEN v_posicao = 'goleiro' THEN 15 ELSE 0 END
      + LEAST(20, v_nivel * 2)
      - v_faltas * 1));

  -- OVR base = média dos 6 atributos; bônus de nível (máx +5).
  v_base := round((v_pac + v_sho + v_pas + v_dri + v_def + v_phy)::numeric / 6);
  v_bonus := LEAST(5, floor(v_nivel / 3.0));
  v_ovr := LEAST(99, GREATEST(1, v_base + v_bonus));

  -- Tema base da carta pela faixa de OVR.
  v_tema := CASE
    WHEN v_ovr < 65 THEN 'bronze'
    WHEN v_ovr <= 74 THEN 'prata'
    ELSE 'ouro'
  END;

  UPDATE public.perfis
  SET ovr = v_ovr,
      stat_ritmo = v_pac,
      stat_finalizacao = v_sho,
      stat_passe = v_pas,
      stat_drible = v_dri,
      stat_defesa = v_def,
      stat_fisico = v_phy,
      tema_carta = v_tema,
      atualizado_em = now()
  WHERE id = usuario;
END;
$$;
