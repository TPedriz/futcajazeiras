-- ============================================================
-- Fut Cajazeiras — Feed Social de Gamificação
-- ------------------------------------------------------------
-- Rode no SQL editor do Lovable (Supabase). Idempotente (pode rodar de novo).
--
-- O que faz:
--   1. Raridade nas conquistas (comum/incomum/rara/epica/lendaria/mitica) +
--      flag `historica` (conquistas concedidas pela diretoria).
--   2. Catálogo complementar (100/250 babas, 50/100/250 gols, assistências,
--      pênaltis, XP e níveis altos) + conquistas históricas.
--   3. Nova tabela `feed_eventos` (feed global de acontecimentos) com
--      idempotência via `chave_unica`, índices e RLS.
--   4. Funções e triggers que geram eventos SEM depender do frontend:
--      - desbloqueia_conquista -> CONQUISTA_DESBLOQUEADA / CONQUISTA_RARA / MARCA_ATINGIDA
--      - trigger em perfis      -> NIVEL_ALCANCADO
--      - verifica_evento_ranking-> RANKING_ALCANCADO (Top 3 / Top 1 do mês)
--      - concede_conquista_historica (admin) -> EVENTO_HISTORICO
--      - modera_evento_feed (admin) -> visibilidade VISIVEL/OCULTO
--   5. Realtime habilitado para feed_eventos (feed atualiza em tempo real).
--
-- Segurança: usuário NUNCA insere/atualiza/apaga eventos; só lê os VISIVEIS.
-- ============================================================

-- ============ 1) Raridade e flag histórica nas conquistas ============
ALTER TABLE public.conquistas
  ADD COLUMN IF NOT EXISTS raridade text NOT NULL DEFAULT 'comum',
  ADD COLUMN IF NOT EXISTS historica boolean NOT NULL DEFAULT false;

-- Backfill determinístico por meta (regra do produto):
--   >= 250 -> lendaria | >= 100 -> epica | >= 50 -> rara | >= 25 -> incomum | demais -> comum
UPDATE public.conquistas
   SET raridade = CASE
     WHEN meta >= 250 THEN 'lendaria'
     WHEN meta >= 100 THEN 'epica'
     WHEN meta >= 50 THEN 'rara'
     WHEN meta >= 25 THEN 'incomum'
     WHEN meta >= 10 THEN 'incomum'
     ELSE 'comum'
   END
 WHERE raridade = 'comum' AND historica IS FALSE;

-- Ajustes finos de raridade para marcos importantes.
UPDATE public.conquistas SET raridade = 'lendaria' WHERE codigo IN ('gols_250','presencas_250','nivel_50');
UPDATE public.conquistas SET raridade = 'epica'    WHERE codigo IN ('gols_100','presencas_100','nivel_25');
UPDATE public.conquistas SET raridade = 'rara'     WHERE codigo IN ('gols_50','presencas_50','nivel_10');

-- ============ 2) Catálogo complementar de conquistas ============
INSERT INTO public.conquistas (codigo, nome, descricao, icone, cor, categoria, meta, raridade) VALUES
  ('presencas_100','Monumento da Lista','Confirme presença em 100 babas.','🏆','gold','presenca',100,'epica'),
  ('presencas_250','Mito da Lista','Confirme presença em 250 babas.','👑','gold','presenca',250,'lendaria'),
  ('gols_50','Artilheiro Nato','Marque 50 gols no total.','🎯','amber','gols',50,'rara'),
  ('gols_100','Matador','Marque 100 gols no total.','💀','amber','gols',100,'epica'),
  ('gols_250','Lenda Artilheira','Marque 250 gols no total.','👑','amber','gols',250,'lendaria'),
  ('assistencias_25','Maestro Consagrado','Dê 25 assistências no total.','🅰️','sky','assistencias',25,'incomum'),
  ('assistencias_50','Maestro de Elite','Dê 50 assistências no total.','🎼','sky','assistencias',50,'rara'),
  ('assistencias_100','Maestro Lendário','Dê 100 assistências no total.','👑','sky','assistencias',100,'epica'),
  ('penaltis_10','Muralha de Ferro','Defenda 10 pênaltis.','🧱','gold','penaltis',10,'incomum'),
  ('penaltis_25','Guardião Implacável','Defenda 25 pênaltis.','🛡️','gold','penaltis',25,'rara'),
  ('xp_5000','Elite do Baba','Acumule 5000 XP.','🚀','rose','xp',5000,'rara'),
  ('xp_10000','Mito do Fut','Acumule 10000 XP.','👑','rose','xp',10000,'epica'),
  ('nivel_25','Lenda em Ascensão','Alcance o nível 25.','🔥','violet','nivel',25,'epica'),
  ('nivel_50','Deus do Baba','Alcance o nível 50.','👑','violet','nivel',50,'lendaria')
ON CONFLICT (codigo) DO NOTHING;

-- Conquistas históricas (concedidas pela diretoria; nunca por estatística).
INSERT INTO public.conquistas (codigo, nome, descricao, icone, cor, categoria, meta, raridade, historica) VALUES
  ('fundador','Fundador','Participou da fase inicial do Fut Cajazeiras.','🌱','gold','historica',1,'mitica',true),
  ('primeira_geracao','Primeira Geração','Fez parte da primeira geração de jogadores cadastrados.','🧬','gold','historica',1,'mitica',true),
  ('primeiro_gol_historico','Primeiro Gol','Marcou o primeiro gol registrado oficialmente no sistema.','⚽','amber','historica',1,'mitica',true),
  ('lenda_fut_cajazeiras','Lenda do Fut Cajazeiras','Conquista histórica extremamente rara.','🏆','gold','historica',1,'mitica',true)
ON CONFLICT (codigo) DO NOTHING;

-- ============ 3) Tabela feed_eventos ============
CREATE TABLE IF NOT EXISTS public.feed_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,              -- CONQUISTA_DESBLOQUEADA | CONQUISTA_RARA | NIVEL_ALCANCADO | MARCA_ATINGIDA | RECORDE_PESSOAL | RANKING_ALCANCADO | EVENTO_HISTORICO
  usuario_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  conquista_id uuid REFERENCES public.conquistas(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibilidade text NOT NULL DEFAULT 'VISIVEL',  -- VISIVEL | OCULTO
  chave_unica text UNIQUE NOT NULL,             -- idempotência do acontecimento original
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Índices para o feed (ORDER BY criado_em DESC + filtros comuns).
CREATE INDEX IF NOT EXISTS idx_feed_eventos_criado_em   ON public.feed_eventos (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_feed_eventos_usuario_em  ON public.feed_eventos (usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_feed_eventos_tipo        ON public.feed_eventos (tipo);
CREATE INDEX IF NOT EXISTS idx_feed_eventos_conquista   ON public.feed_eventos (conquista_id);

-- ============ 4) RLS do feed ============
ALTER TABLE public.feed_eventos ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.feed_eventos TO authenticated;
GRANT ALL ON public.feed_eventos TO service_role;

-- Usuários autenticados leem SOMENTE eventos visíveis. Não há política de
-- INSERT/UPDATE/DELETE para authenticated: o feed só muda via funções
-- SECURITY DEFINER (backend/trigger), nunca pelo navegador.
DROP POLICY IF EXISTS "Autenticados leem eventos visiveis" ON public.feed_eventos;
CREATE POLICY "Autenticados leem eventos visiveis" ON public.feed_eventos
  FOR SELECT TO authenticated USING (visibilidade = 'VISIVEL');

-- ============ 5) Realtime para o feed ============
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feed_eventos;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============ 6) Helper: cria evento de forma idempotente ============
CREATE OR REPLACE FUNCTION public.cria_evento_feed(
  p_tipo text,
  p_usuario uuid,
  p_conquista uuid,
  p_titulo text,
  p_descricao text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_chave text DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_chave text;
  v_id uuid;
BEGIN
  IF p_usuario IS NULL OR p_tipo IS NULL OR p_titulo IS NULL OR p_titulo = '' THEN
    RETURN NULL;
  END IF;
  v_chave := COALESCE(
    p_chave,
    p_tipo || ':' || p_usuario::text || ':' || COALESCE(p_conquista::text, 'sem-conquista')
  );
  INSERT INTO public.feed_eventos (tipo, usuario_id, conquista_id, titulo, descricao, metadata, chave_unica)
  VALUES (p_tipo, p_usuario, p_conquista, p_titulo, p_descricao, p_metadata, v_chave)
  ON CONFLICT (chave_unica) DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.cria_evento_feed(text, uuid, uuid, text, text, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cria_evento_feed(text, uuid, uuid, text, text, jsonb, text) TO service_role;

-- ============ 7) Conquista desbloqueada -> evento no feed ============
CREATE OR REPLACE FUNCTION public.desbloqueia_conquista(usuario uuid, conquista uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nome text;
  v_descricao text;
  v_raridade text;
  v_meta integer;
  v_categoria text;
  v_icone text;
  v_tipo text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.usuario_conquistas
             WHERE usuario_id = usuario AND conquista_id = conquista) THEN
    RETURN;
  END IF;
  INSERT INTO public.usuario_conquistas (usuario_id, conquista_id)
  VALUES (usuario, conquista);

  SELECT nome, descricao, raridade, meta, categoria, icone
    INTO v_nome, v_descricao, v_raridade, v_meta, v_categoria, v_icone
    FROM public.conquistas WHERE id = conquista;

  -- Raridade rara+ vira CONQUISTA_RARA; as demais, CONQUISTA_DESBLOQUEADA.
  IF v_raridade IN ('rara','epica','lendaria','mitica') THEN
    v_tipo := 'CONQUISTA_RARA';
  ELSE
    v_tipo := 'CONQUISTA_DESBLOQUEADA';
  END IF;
  PERFORM public.cria_evento_feed(
    v_tipo, usuario, conquista,
    v_nome,
    COALESCE(v_descricao, ''),
    jsonb_build_object('raridade', v_raridade, 'categoria', v_categoria, 'meta', v_meta, 'icone', v_icone),
    'conquista:' || usuario::text || ':' || conquista::text
  );

  -- Marca histórica: metas 100+ geram evento MARCA_ATINGIDA (ex.: 100º gol).
  IF v_meta >= 100 AND v_categoria IN ('gols','assistencias','presenca') THEN
    PERFORM public.cria_evento_feed(
      'MARCA_ATINGIDA', usuario, conquista,
      v_nome || ' — marca atingida',
      'Marca alcançada: ' || v_meta || ' na categoria ' || v_categoria || '.',
      jsonb_build_object('categoria', v_categoria, 'meta', v_meta, 'icone', v_icone),
      'marca:' || usuario::text || ':' || conquista::text
    );
  END IF;

  PERFORM public.notifica(usuario, 'conquista', 'Conquista desbloqueada!',
    'Você desbloqueou a conquista "' || v_nome || '".');
END;
$$;
REVOKE ALL ON FUNCTION public.desbloqueia_conquista(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desbloqueia_conquista(uuid, uuid) TO service_role;

-- ============ 8) Nível alcançado -> evento no feed ============
CREATE OR REPLACE FUNCTION public.registra_evento_nivel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.nivel_atual > OLD.nivel_atual THEN
    PERFORM public.cria_evento_feed(
      'NIVEL_ALCANCADO', NEW.id, NULL,
      'Nível ' || NEW.nivel_atual,
      'Alcançou o nível ' || NEW.nivel_atual || ' com ' || NEW.xp_atual || ' XP acumulados.',
      jsonb_build_object('nivel_anterior', OLD.nivel_atual, 'nivel_novo', NEW.nivel_atual, 'xp_total', NEW.xp_atual),
      'nivel:' || NEW.id::text || ':' || NEW.nivel_atual::text
    );
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_feed_nivel ON public.perfis;
CREATE TRIGGER trg_feed_nivel
  AFTER UPDATE OF nivel_atual ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.registra_evento_nivel();

-- ============ 9) Ranking (Top 3 / Top 1 do mês) -> evento no feed ============
CREATE OR REPLACE FUNCTION public.verifica_evento_ranking(p_usuario uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_mes date;
  v_cat text;
  v_pos integer;
  v_valor integer;
  v_categorias text[] := ARRAY['gols','assistencias','penaltis_defendidos','vitorias'];
BEGIN
  IF p_usuario IS NULL THEN
    RETURN;
  END IF;
  v_mes := date_trunc('month', now())::date;

  FOREACH v_cat IN ARRAY v_categorias LOOP
    EXECUTE format(
      'SELECT posicao, valor FROM (
         SELECT usuario_id,
                row_number() OVER (ORDER BY %I DESC NULLS LAST, nome ASC) AS posicao,
                %I AS valor
         FROM public.ranking_mensal
         WHERE mes = $1
       ) sub WHERE usuario_id = $2',
      v_cat, v_cat
    ) INTO v_pos, v_valor USING v_mes, p_usuario;

    IF v_pos IS NOT NULL AND COALESCE(v_valor, 0) > 0 THEN
      IF v_pos = 1 THEN
        PERFORM public.cria_evento_feed(
          'RANKING_ALCANCADO', p_usuario, NULL,
          'Líder do mês em ' || v_cat,
          'Assumiu a 1ª posição do ranking mensal de ' || v_cat || ' com ' || v_valor || '.',
          jsonb_build_object('categoria', v_cat, 'posicao_nova', 1, 'valor', v_valor, 'mes', to_char(v_mes, 'YYYY-MM-01')),
          'ranking:' || p_usuario::text || ':' || v_mes::text || ':' || v_cat || ':top1'
        );
      ELSIF v_pos <= 3 THEN
        PERFORM public.cria_evento_feed(
          'RANKING_ALCANCADO', p_usuario, NULL,
          'Top 3 do mês em ' || v_cat,
          'Entrou no Top 3 do ranking mensal de ' || v_cat || ' com ' || v_valor || '.',
          jsonb_build_object('categoria', v_cat, 'posicao_nova', v_pos, 'valor', v_valor, 'mes', to_char(v_mes, 'YYYY-MM-01')),
          'ranking:' || p_usuario::text || ':' || v_mes::text || ':' || v_cat || ':top3'
        );
      END IF;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.verifica_evento_ranking(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verifica_evento_ranking(uuid) TO service_role;

-- Dispara a verificação de ranking junto com a reavaliação de conquistas
-- quando as estatísticas de um baba mudam (mantém o trigger existente).
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
    PERFORM public.verifica_evento_ranking(v_usuario);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============ 10) Moderação (admin) ============
CREATE OR REPLACE FUNCTION public.modera_evento_feed(p_evento_id uuid, p_visibilidade text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.tem_papel(auth.uid(), 'administrador') THEN
    RAISE EXCEPTION 'Somente administradores podem moderar eventos do feed';
  END IF;
  IF p_visibilidade NOT IN ('VISIVEL','OCULTO') THEN
    RAISE EXCEPTION 'Visibilidade inválida';
  END IF;
  UPDATE public.feed_eventos SET visibilidade = p_visibilidade WHERE id = p_evento_id;
END;
$$;
REVOKE ALL ON FUNCTION public.modera_evento_feed(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.modera_evento_feed(uuid, text) TO authenticated;

-- ============ 11) Conquista histórica (admin) ============
CREATE OR REPLACE FUNCTION public.concede_conquista_historica(
  p_usuario uuid,
  p_codigo text,
  p_titulo text,
  p_descricao text,
  p_icone text DEFAULT '🏆',
  p_cor text DEFAULT 'gold',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_conquista uuid;
  v_ja uuid;
BEGIN
  IF NOT public.tem_papel(auth.uid(), 'administrador') THEN
    RAISE EXCEPTION 'Somente administradores podem conceder conquistas históricas';
  END IF;

  SELECT id INTO v_conquista FROM public.conquistas WHERE codigo = p_codigo;
  IF v_conquista IS NULL THEN
    INSERT INTO public.conquistas (codigo, nome, descricao, icone, cor, categoria, meta, raridade, historica)
    VALUES (p_codigo, p_titulo, p_descricao, p_icone, p_cor, 'historica', 1, 'mitica', true)
    RETURNING id INTO v_conquista;
  END IF;

  SELECT id INTO v_ja FROM public.usuario_conquistas
    WHERE usuario_id = p_usuario AND conquista_id = v_conquista;
  IF v_ja IS NOT NULL THEN
    RETURN v_ja;
  END IF;

  INSERT INTO public.usuario_conquistas (usuario_id, conquista_id) VALUES (p_usuario, v_conquista);
  PERFORM public.cria_evento_feed(
    'EVENTO_HISTORICO', p_usuario, v_conquista,
    p_titulo, p_descricao, p_metadata,
    'historico:' || p_usuario::text || ':' || v_conquista::text
  );
  PERFORM public.notifica(p_usuario, 'conquista', 'Conquista histórica!',
    'Você recebeu a conquista "' || p_titulo || '".');
  RETURN v_conquista;
END;
$$;
REVOKE ALL ON FUNCTION public.concede_conquista_historica(uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concede_conquista_historica(uuid, text, text, text, text, text, jsonb) TO authenticated;
