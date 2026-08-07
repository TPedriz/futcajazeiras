ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS ovr integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS stat_ritmo integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS stat_finalizacao integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS stat_passe integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS stat_drible integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS stat_defesa integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS stat_fisico integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS tema_carta text NOT NULL DEFAULT 'ouro';

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

  SELECT COUNT(*) INTO v_babas_total
    FROM public.sessoes_baba WHERE data_horario <= now();

  SELECT COUNT(*) INTO v_presencas
    FROM public.presencas
    WHERE compareceu IS TRUE
      AND ((usuario_id = usuario AND nome_convidado IS NULL) OR convidado_user_id = usuario);

  SELECT COALESCE(SUM(gols), 0), COALESCE(SUM(assistencias), 0),
         COALESCE(SUM(penaltis_defendidos), 0),
         COALESCE(SUM(cartoes_amarelos), 0),
         COALESCE(SUM(cartoes_azuis), 0),
         COALESCE(SUM(cartoes_vermelhos), 0)
    INTO v_gols, v_assists, v_penaltis, v_ca, v_caz, v_cv
    FROM public.estatisticas_baba WHERE usuario_id = usuario;

  SELECT COUNT(*) INTO v_vitorias
    FROM public.times_jogadores tj
    JOIN public.times_baba t ON t.id = tj.time_id
    WHERE tj.usuario_id = usuario AND t.resultado = 'vitoria';

  v_freq := CASE WHEN v_babas_total > 0
    THEN LEAST(1.0, v_presencas::numeric / v_babas_total) ELSE 0 END;

  v_pac := LEAST(99, GREATEST(1, 40 + round(v_freq * 59)));

  v_sho := LEAST(99, GREATEST(1, 40 + round(
    CASE WHEN v_presencas > 0 THEN (v_gols::numeric / v_presencas) * 15 ELSE 0 END)));

  v_pas := LEAST(99, GREATEST(1, 40 + round(
    CASE WHEN v_presencas > 0 THEN (v_assists::numeric / v_presencas) * 15 ELSE 0 END)));

  v_dri := LEAST(99, GREATEST(1, 40 + round(
    CASE WHEN v_presencas > 0
      THEN (v_vitorias::numeric / v_presencas) * 12 + (v_gols::numeric / v_presencas) * 3
      ELSE 0 END)));

  v_def := LEAST(99, GREATEST(1, 40 + round(
    CASE WHEN v_presencas > 0 THEN (v_vitorias::numeric / v_presencas) * 10 ELSE 0 END)
    - v_ca * 2 - v_caz * 3 - v_cv * 6));

  v_phy := LEAST(99, GREATEST(1,
    40 + v_penaltis * 8
      + CASE WHEN v_posicao = 'goleiro' THEN 15 ELSE 0 END
      + LEAST(20, v_nivel * 2)));

  v_base := round((v_pac + v_sho + v_pas + v_dri + v_def + v_phy)::numeric / 6);
  v_bonus := LEAST(5, floor(v_nivel / 3.0));
  v_ovr := LEAST(99, GREATEST(1, v_base + v_bonus));

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
REVOKE ALL ON FUNCTION public.calcula_cartinha(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calcula_cartinha(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.atualiza_cartinha_presenca()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.calcula_cartinha(OLD.usuario_id);
    IF OLD.convidado_user_id IS NOT NULL THEN
      PERFORM public.calcula_cartinha(OLD.convidado_user_id);
    END IF;
  ELSE
    PERFORM public.calcula_cartinha(NEW.usuario_id);
    IF NEW.convidado_user_id IS NOT NULL THEN
      PERFORM public.calcula_cartinha(NEW.convidado_user_id);
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_cartinha_presenca ON public.presencas;
CREATE TRIGGER trg_cartinha_presenca
  AFTER INSERT OR UPDATE OF compareceu OR DELETE ON public.presencas
  FOR EACH ROW EXECUTE FUNCTION public.atualiza_cartinha_presenca();

CREATE OR REPLACE FUNCTION public.atualiza_cartinha_estatisticas()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.calcula_cartinha(OLD.usuario_id);
  ELSE
    PERFORM public.calcula_cartinha(NEW.usuario_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_cartinha_estatisticas ON public.estatisticas_baba;
CREATE TRIGGER trg_cartinha_estatisticas
  AFTER INSERT OR UPDATE OR DELETE ON public.estatisticas_baba
  FOR EACH ROW EXECUTE FUNCTION public.atualiza_cartinha_estatisticas();

CREATE OR REPLACE FUNCTION public.atualiza_cartinha_times()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  u uuid;
  v_baba uuid;
BEGIN
  v_baba := COALESCE(NEW.baba_id, OLD.baba_id);
  FOR u IN
    SELECT DISTINCT tj.usuario_id
    FROM public.times_jogadores tj
    WHERE tj.time_id IN (
      SELECT id FROM public.times_baba WHERE baba_id = v_baba
    ) AND tj.usuario_id IS NOT NULL
  LOOP
    PERFORM public.calcula_cartinha(u);
  END LOOP;
  RETURN COALESCE(NEW, OLD);
END;
$$;
DROP TRIGGER IF EXISTS trg_cartinha_times ON public.times_baba;
CREATE TRIGGER trg_cartinha_times
  AFTER INSERT OR UPDATE OF resultado OR DELETE ON public.times_baba
  FOR EACH ROW EXECUTE FUNCTION public.atualiza_cartinha_times();

SELECT public.calcula_cartinha(id) FROM public.perfis;