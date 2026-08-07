-- ============ 1) Perfil: XP e nível ============
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS xp_atual integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nivel_atual integer NOT NULL DEFAULT 1;

-- ============ 2) Catálogo de conquistas ============
CREATE TABLE public.conquistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  nome text NOT NULL,
  descricao text NOT NULL,
  icone text NOT NULL DEFAULT '🏆',
  cor text NOT NULL DEFAULT 'gold',
  categoria text NOT NULL,
  meta integer NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.conquistas TO authenticated;
GRANT ALL ON public.conquistas TO service_role;
ALTER TABLE public.conquistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leem conquistas" ON public.conquistas
  FOR SELECT TO authenticated USING (true);

-- ============ 3) Vínculo usuário ↔ conquista ============
CREATE TABLE public.usuario_conquistas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  conquista_id uuid NOT NULL REFERENCES public.conquistas(id) ON DELETE CASCADE,
  desbloqueada_em timestamptz NOT NULL DEFAULT now(),
  em_destaque boolean NOT NULL DEFAULT false,
  ordem_destaque integer,
  UNIQUE (usuario_id, conquista_id)
);

GRANT SELECT, UPDATE ON public.usuario_conquistas TO authenticated;
GRANT ALL ON public.usuario_conquistas TO service_role;
ALTER TABLE public.usuario_conquistas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leem conquistas dos usuários" ON public.usuario_conquistas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuário atualiza próprios destaques" ON public.usuario_conquistas
  FOR UPDATE TO authenticated USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());

CREATE OR REPLACE FUNCTION public.limita_destaques_conquistas()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_qtd integer;
  v_id uuid;
BEGIN
  IF NEW.em_destaque IS TRUE THEN
    v_id := COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000');
    SELECT COUNT(*) INTO v_qtd FROM public.usuario_conquistas
      WHERE usuario_id = NEW.usuario_id AND em_destaque IS TRUE AND id <> v_id;
    IF v_qtd >= 3 THEN
      RAISE EXCEPTION 'Você pode destacar no máximo 3 conquistas';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_limita_destaques ON public.usuario_conquistas;
CREATE TRIGGER trg_limita_destaques
  BEFORE INSERT OR UPDATE OF em_destaque ON public.usuario_conquistas
  FOR EACH ROW EXECUTE FUNCTION public.limita_destaques_conquistas();

-- ============ 4) Helpers de XP e níveis ============
CREATE OR REPLACE FUNCTION public.xp_necessaria_para_nivel(nivel integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT 100 * nivel * (nivel - 1) / 2;
$$;

CREATE OR REPLACE FUNCTION public.nivel_para_xp(xp integer)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT floor((1 + sqrt(1 + 8.0 * GREATEST(xp, 0) / 100)) / 2)::integer;
$$;

CREATE OR REPLACE FUNCTION public.desbloqueia_conquista(usuario uuid, conquista uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nome text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.usuario_conquistas
             WHERE usuario_id = usuario AND conquista_id = conquista) THEN
    RETURN;
  END IF;
  INSERT INTO public.usuario_conquistas (usuario_id, conquista_id)
  VALUES (usuario, conquista);

  SELECT nome INTO v_nome FROM public.conquistas WHERE id = conquista;
  PERFORM public.notifica(usuario, 'conquista', 'Conquista desbloqueada!',
    'Você desbloqueou a conquista "' || v_nome || '".');
END;
$$;
REVOKE ALL ON FUNCTION public.desbloqueia_conquista(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.desbloqueia_conquista(uuid, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.verifica_conquistas(usuario uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_presencas integer;
  v_gols integer;
  v_assistencias integer;
  v_xp integer;
  v_nivel integer;
  c record;
BEGIN
  IF usuario IS NULL THEN
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_presencas
    FROM public.presencas
    WHERE compareceu IS TRUE
      AND (
        (usuario_id = usuario AND nome_convidado IS NULL)
        OR convidado_user_id = usuario
      );

  SELECT COALESCE(SUM(gols), 0), COALESCE(SUM(assistencias), 0)
    INTO v_gols, v_assistencias
    FROM public.estatisticas_baba WHERE usuario_id = usuario;

  SELECT xp_atual, nivel_atual INTO v_xp, v_nivel
    FROM public.perfis WHERE id = usuario;

  FOR c IN SELECT * FROM public.conquistas LOOP
    IF c.categoria = 'presenca' AND v_presencas >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'gols' AND v_gols >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'assistencias' AND v_assistencias >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'nivel' AND v_nivel >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    ELSIF c.categoria = 'xp' AND v_xp >= c.meta THEN
      PERFORM public.desbloqueia_conquista(usuario, c.id);
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.verifica_conquistas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.verifica_conquistas(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.concede_xp(usuario uuid, quantidade integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_novo_xp integer;
BEGIN
  IF usuario IS NULL OR quantidade IS NULL OR quantidade <= 0 THEN
    RETURN 0;
  END IF;
  UPDATE public.perfis
  SET xp_atual = xp_atual + quantidade,
      nivel_atual = public.nivel_para_xp(xp_atual + quantidade),
      atualizado_em = now()
  WHERE id = usuario
  RETURNING xp_atual INTO v_novo_xp;

  IF v_novo_xp IS NOT NULL THEN
    PERFORM public.verifica_conquistas(usuario);
  END IF;
  RETURN v_novo_xp;
END;
$$;
REVOKE ALL ON FUNCTION public.concede_xp(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.concede_xp(uuid, integer) TO service_role;

-- ============ 6) Triggers automáticos de XP ============
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
      PERFORM public.concede_xp(v_jogador, 10);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_xp_presenca ON public.presencas;
CREATE TRIGGER trg_xp_presenca
  AFTER INSERT OR UPDATE OF compareceu ON public.presencas
  FOR EACH ROW EXECUTE FUNCTION public.ganho_xp_presenca();

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
    PERFORM public.concede_xp(NEW.usuario_id, v_gols * 5 + v_assists * 3);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_xp_estatisticas ON public.estatisticas_baba;
CREATE TRIGGER trg_xp_estatisticas
  AFTER INSERT OR UPDATE OF gols, assistencias ON public.estatisticas_baba
  FOR EACH ROW EXECUTE FUNCTION public.ganho_xp_estatisticas();

-- ============ 7) Seed do catálogo de conquistas ============
INSERT INTO public.conquistas (codigo, nome, descricao, icone, cor, categoria, meta) VALUES
  ('primeira_presenca', 'Primeira Presença', 'Confirme presença pela primeira vez em um baba.', '📋', 'gold', 'presenca', 1),
  ('presencas_5', 'Fiel à Lista', 'Confirme presença em 5 babas.', '✅', 'gold', 'presenca', 5),
  ('presencas_10', 'Sempre Presente', 'Confirme presença em 10 babas.', '🗓️', 'gold', 'presenca', 10),
  ('presencas_25', 'Craque de Elenco', 'Confirme presença em 25 babas.', '🎖️', 'gold', 'presenca', 25),
  ('presencas_50', 'Lenda da Lista', 'Confirme presença em 50 babas.', '🏅', 'gold', 'presenca', 50),
  ('primeiro_gol', 'Primeiro Gol', 'Marque seu primeiro gol.', '⚽', 'amber', 'gols', 1),
  ('gols_5', 'Artilheiro em Formação', 'Marque 5 gols no total.', '🎯', 'amber', 'gols', 5),
  ('gols_10', 'Artilheiro', 'Marque 10 gols no total.', '🔥', 'amber', 'gols', 10),
  ('gols_25', 'Máquina de Gols', 'Marque 25 gols no total.', '🚀', 'amber', 'gols', 25),
  ('primeira_assistencia', 'Primeira Assistência', 'Dê sua primeira assistência.', '🎁', 'sky', 'assistencias', 1),
  ('assistencias_5', 'Garçom', 'Dê 5 assistências no total.', '🅰️', 'sky', 'assistencias', 5),
  ('assistencias_10', 'Maestro do Passe', 'Dê 10 assistências no total.', '🪄', 'sky', 'assistencias', 10),
  ('nivel_3', 'Nível 3', 'Alcance o nível 3.', '🛡️', 'violet', 'nivel', 3),
  ('nivel_5', 'Nível 5', 'Alcance o nível 5.', '🥈', 'violet', 'nivel', 5),
  ('nivel_10', 'Nível 10', 'Alcance o nível 10.', '🥇', 'violet', 'nivel', 10),
  ('xp_500', 'Veterano', 'Acumule 500 XP.', '💪', 'rose', 'xp', 500),
  ('xp_1000', 'Experiente', 'Acumule 1000 XP.', '🧠', 'rose', 'xp', 1000),
  ('xp_2500', 'Verdadeiro Campeão', 'Acumule 2500 XP.', '🏆', 'rose', 'xp', 2500)
ON CONFLICT (codigo) DO NOTHING;