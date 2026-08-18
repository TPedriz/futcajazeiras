INSERT INTO public.conquistas (codigo, nome, descricao, icone, cor, categoria, meta, raridade, historica) VALUES
  ('desenvolvedor','Arquiteto do Fut','Criou e desenvolveu a plataforma do Fut Cajazeiras. A conquista mais rara do site.','🧙‍♂️','violet','historica',1,'mitica',true),
  ('socio_fundador','Sócio-Fundador','Idealizou, criou e financiou o Fut Cajazeiras desde o primeiro baba.','💎','gold','historica',1,'mitica',true)
ON CONFLICT (codigo) DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_concede_conquista(_usuario uuid, _conquista uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_nome text; v_descricao text; v_icone text; v_cor text; v_raridade text; v_ja uuid;
BEGIN
  IF NOT public.tem_papel(auth.uid(), 'administrador') THEN
    RAISE EXCEPTION 'Somente administradores podem conceder conquistas';
  END IF;

  SELECT nome, descricao, icone, cor, raridade
    INTO v_nome, v_descricao, v_icone, v_cor, v_raridade
    FROM public.conquistas WHERE id = _conquista;
  IF v_nome IS NULL THEN
    RAISE EXCEPTION 'Conquista inexistente';
  END IF;

  SELECT id INTO v_ja FROM public.usuario_conquistas
    WHERE usuario_id = _usuario AND conquista_id = _conquista;
  IF v_ja IS NOT NULL THEN
    RETURN v_ja;
  END IF;

  INSERT INTO public.usuario_conquistas (usuario_id, conquista_id)
  VALUES (_usuario, _conquista)
  RETURNING id INTO v_ja;

  PERFORM public.cria_evento_feed(
    CASE WHEN v_raridade IN ('rara','epica','lendaria','mitica') THEN 'CONQUISTA_RARA' ELSE 'CONQUISTA_DESBLOQUEADA' END,
    _usuario, _conquista, v_nome, v_descricao,
    jsonb_build_object('raridade', v_raridade, 'icone', v_icone, 'cor', v_cor, 'concedida_por', auth.uid()),
    'conquista:' || _usuario::text || ':' || _conquista::text
  );
  PERFORM public.notifica(_usuario, 'conquista', 'Conquista concedida!',
    'A diretoria concedeu a você a conquista "' || v_nome || '".', '/conquistas');
  RETURN v_ja;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_concede_conquista(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_concede_conquista(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_remove_conquista(_usuario uuid, _conquista uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.tem_papel(auth.uid(), 'administrador') THEN
    RAISE EXCEPTION 'Somente administradores podem remover conquistas';
  END IF;
  DELETE FROM public.usuario_conquistas WHERE usuario_id = _usuario AND conquista_id = _conquista;
  DELETE FROM public.feed_eventos WHERE usuario_id = _usuario AND conquista_id = _conquista;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_remove_conquista(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_conquista(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.conquistas_do_usuario(_usuario uuid)
RETURNS TABLE(conquista_id uuid, desbloqueada_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT uc.conquista_id, uc.desbloqueada_em
    FROM public.usuario_conquistas uc
   WHERE uc.usuario_id = _usuario
     AND (public.tem_papel(auth.uid(), 'administrador') OR uc.usuario_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.conquistas_do_usuario(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.conquistas_do_usuario(uuid) TO authenticated;