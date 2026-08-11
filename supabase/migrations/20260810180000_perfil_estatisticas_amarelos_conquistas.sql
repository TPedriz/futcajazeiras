-- ============================================================
-- Fut Cajazeiras — Perfil: cartões amarelos (janela) + conquistas + ranking cartinhas
-- ------------------------------------------------------------
-- Rode no SQL editor do Lovable (Supabase). Idempotente (pode rodar de novo).
--
-- O que faz:
--   1. Nova política de CARTÕES AMARELOS em janela (configurável):
--      janela_amarelos / limite_amarelos / suspensao_amarelos_babas.
--      Ao atingir o limite de amarelos na janela, o jogador é suspenso do
--      próximo baba (trigger em estatisticas_baba.cartoes_amarelos).
--   2. Conquistas NOVAS (boas e "ruins", incl. "Infiltrado" = gol contra) e
--      verifica_conquistas estendido (pênaltis, vitórias, amarelos, faltas,
--      gols contra).
--   3. View pública ranking_cartinhas (só campos de cartinha) para o ranking
--      top 3 por categoria no perfil.
-- ============================================================

-- 1. Política de cartões amarelos (janela) — novas chaves configuráveis.
INSERT INTO public.configuracoes (chave, valor) VALUES
  ('janela_amarelos', 5),
  ('limite_amarelos', 3),
  ('suspensao_amarelos_babas', 1)
ON CONFLICT (chave) DO NOTHING;

-- 2. Suspensão por janela de cartões amarelos (espelha aplica_suspensao_faltas).
CREATE OR REPLACE FUNCTION public.aplica_suspensao_amarelos()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_janela integer;
  v_limite integer;
  v_qtd integer;
  v_amarelos integer;
  v_criadas integer;
BEGIN
  -- Só dispara quando o nº de amarelos AUMENTA (novo cartão no baba).
  IF NEW.cartoes_amarelos <= COALESCE(OLD.cartoes_amarelos, 0) THEN
    RETURN NEW;
  END IF;

  v_janela := public.config_int('janela_amarelos', 5);
  v_limite := public.config_int('limite_amarelos', 3);
  v_qtd    := public.config_int('suspensao_amarelos_babas', 1);
  IF v_limite < 1 OR v_qtd < 1 THEN
    RETURN NEW;
  END IF;

  -- Conta os amarelos do usuário nos últimos v_janela babas (até o baba atual).
  SELECT COALESCE(SUM(e.cartoes_amarelos), 0)::int INTO v_amarelos
  FROM public.estatisticas_baba e
  JOIN public.sessoes_baba s ON s.id = e.baba_id
  WHERE e.usuario_id = NEW.usuario_id
    AND s.data_horario <= (SELECT data_horario FROM public.sessoes_baba WHERE id = NEW.baba_id)
    AND s.id IN (
      SELECT id FROM public.sessoes_baba
      WHERE data_horario <= (SELECT data_horario FROM public.sessoes_baba WHERE id = NEW.baba_id)
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

DROP TRIGGER IF EXISTS trg_suspensao_amarelos ON public.estatisticas_baba;
CREATE TRIGGER trg_suspensao_amarelos
  AFTER INSERT OR UPDATE OF cartoes_amarelos ON public.estatisticas_baba
  FOR EACH ROW EXECUTE FUNCTION public.aplica_suspensao_amarelos();

-- 3. Conquistas novas (boas e ruins). "Infiltrado" = marcar gol contra.
INSERT INTO public.conquistas (codigo, nome, descricao, icone, cor, categoria, meta) VALUES
  -- Pênaltis defendidos (boas)
  ('penalti_1','Paredão','Defenda um pênalti.','🧤','gold','penaltis',1),
  ('penaltis_5','Muralha','Defenda 5 pênaltis.','🧱','gold','penaltis',5),
  -- Vitórias (boas)
  ('vitorias_10','Vencedor','Vença 10 babas.','🏆','amber','vitorias',10),
  ('vitorias_25','Cicatriz de Guerra','Vença 25 babas.','⚔️','amber','vitorias',25),
  -- Cartões amarelos (ruins)
  ('amarelo_3','Cartão de Visitas','Receba 3 cartões amarelos no total.','🟨','rose','cartoes',3),
  ('amarelos_10','Habitue-se','Receba 10 cartões amarelos no total.','🚦','rose','cartoes',10),
  -- Faltas (ruins)
  ('faltas_10','Carrinho','Cometa 10 faltas no total.','🛞','rose','faltas',10),
  -- Gols contra (ruins)
  ('gol_contra_1','Infiltrado','Marque um gol contra.','💥','rose','gols_contra',1),
  ('gols_contra_3','Saqueador do Próprio Gol','Marque 3 gols contra.','🧨','rose','gols_contra',3)
ON CONFLICT (codigo) DO NOTHING;

-- 4. verifica_conquistas estendido: pênaltis, vitórias, amarelos, faltas, gols contra.
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
    ELSIF c.categoria = 'nivel' AND v_nivel >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'xp' AND v_xp >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    END IF;
  END LOOP;
END;
$$;

-- 4b. Reavalia conquistas sempre que as estatísticas de um baba mudam
--     (gols contra, cartões, faltas, pênaltis, vitórias...).
CREATE OR REPLACE FUNCTION public.reavalia_conquistas_estatisticas()
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
    PERFORM public.verifica_conquistas(v_usuario);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_conquistas_estatisticas ON public.estatisticas_baba;
CREATE TRIGGER trg_conquistas_estatisticas
  AFTER INSERT OR UPDATE OR DELETE ON public.estatisticas_baba
  FOR EACH ROW EXECUTE FUNCTION public.reavalia_conquistas_estatisticas();

-- 5. View pública do ranking de cartinhas (só campos de cartinha — sem e-mail/
--    telefone). Sem security_invoker: roda como owner e libera a leitura do
--    ranking para todos os autenticados.
CREATE OR REPLACE VIEW public.ranking_cartinhas AS
SELECT id, nome, avatar_url, posicao, ovr,
       stat_ritmo, stat_finalizacao, stat_passe, stat_drible, stat_defesa, stat_fisico,
       tema_carta
FROM public.perfis
WHERE ativo = true;

GRANT SELECT ON public.ranking_cartinhas TO authenticated;

-- 6. Backfill: reavalia as conquistas de todos os jogadores já cadastrados.
SELECT public.verifica_conquistas(id) FROM public.perfis;
