-- ============================================================
-- Fut Cajazeiras — Suspensões: mural só com ativas + penalidade na cartinha
-- ------------------------------------------------------------
-- Rode no SQL editor do Lovable (Supabase). Idempotente (pode rodar de novo).
--
-- O que faz:
--   1. `calcula_cartinha` passa a descontar da nota por SUSPENSÕES ATIVAS
--      (baba bloqueado ainda no futuro). Cada suspensão ativa = -5 no OVR
--      (máx -20), além de derrubar DEF e FÍS.
--   2. Recalcula a cartinha automaticamente quando uma suspensão é criada
--      ou removida (triggers).
--   3. Recalcula todas as cartinhas agora (backfill do novo desconto).
--
-- Obs.: a saída do MURAL de suspensões (nome some quando o baba passa) é
-- feita na query do app (`suspensoesQuery`), sem necessidade de mudança aqui.
-- ============================================================

-- 1. Função de cálculo da cartinha com desconto por suspensões ativas.
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
  v_suspensoes integer;
  v_desconto integer;
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

  -- Suspensões ATIVAS (baba bloqueado ainda no futuro) — derrubam a nota.
  SELECT COUNT(*) INTO v_suspensoes
    FROM public.suspensoes s
    JOIN public.sessoes_baba b ON b.id = s.baba_bloqueado_id
    WHERE s.usuario_id = usuario AND b.data_horario > now();
  v_desconto := LEAST(20, v_suspensoes * 5);

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
  -- faltas cometidas, gols contra e SUSPENSÕES ATIVAS.
  v_def := LEAST(99, GREATEST(1, round(
    CASE WHEN v_presencas > 0 THEN (v_vitorias::numeric / v_presencas) * 10 ELSE 0 END)
    - v_ca * 2 - v_caz * 3 - v_cv * 6 - v_faltas * 1 - v_gc * 3 - v_desconto));

  -- PHY (Físico): pênaltis defendidos + bônus de goleiro + nível de XP,
  -- com desconto por faltas cometidas e SUSPENSÕES ATIVAS.
  v_phy := LEAST(99, GREATEST(1,
    40 + v_penaltis * 8
      + CASE WHEN v_posicao = 'goleiro' THEN 15 ELSE 0 END
      + LEAST(20, v_nivel * 2)
      - v_faltas * 1 - v_desconto));

  -- OVR base = média dos 6 atributos; bônus de nível (máx +5) e desconto
  -- por suspensões ativas (derruba bastante a nota).
  v_base := round((v_pac + v_sho + v_pas + v_dri + v_def + v_phy)::numeric / 6);
  v_bonus := LEAST(5, floor(v_nivel / 3.0));
  v_ovr := LEAST(99, GREATEST(1, v_base + v_bonus - v_desconto));

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

-- 2. Recalcula a cartinha automaticamente quando uma suspensão é criada/removida.
CREATE OR REPLACE FUNCTION public.recalcula_cartinha_apos_suspensao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_usuario uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_usuario := OLD.usuario_id;
  ELSE
    v_usuario := NEW.usuario_id;
  END IF;
  IF v_usuario IS NOT NULL THEN
    PERFORM public.calcula_cartinha(v_usuario);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_suspensao_recalcula_cartinha_insert ON public.suspensoes;
CREATE TRIGGER trg_suspensao_recalcula_cartinha_insert
  AFTER INSERT ON public.suspensoes
  FOR EACH ROW EXECUTE FUNCTION public.recalcula_cartinha_apos_suspensao();

DROP TRIGGER IF EXISTS trg_suspensao_recalcula_cartinha_delete ON public.suspensoes;
CREATE TRIGGER trg_suspensao_recalcula_cartinha_delete
  AFTER DELETE ON public.suspensoes
  FOR EACH ROW EXECUTE FUNCTION public.recalcula_cartinha_apos_suspensao();

-- 3. Recalcula todas as cartinhas agora (aplica o novo desconto).
SELECT public.calcula_cartinha(id) FROM public.perfis;
