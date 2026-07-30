-- 1. Configurações do clube (valor da mensalidade dinâmico)
CREATE TABLE IF NOT EXISTS public.configuracoes (
  chave text PRIMARY KEY,
  valor numeric NOT NULL,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes TO authenticated;
GRANT ALL ON public.configuracoes TO service_role;
ALTER TABLE public.configuracoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Todos leem configuracoes" ON public.configuracoes;
CREATE POLICY "Todos leem configuracoes" ON public.configuracoes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Diretoria gerencia configuracoes" ON public.configuracoes;
CREATE POLICY "Diretoria gerencia configuracoes" ON public.configuracoes FOR ALL TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));
INSERT INTO public.configuracoes (chave, valor) VALUES ('valor_mensalidade', 20)
  ON CONFLICT (chave) DO NOTHING;

CREATE OR REPLACE FUNCTION public.valor_mensalidade()
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT valor FROM public.configuracoes WHERE chave = 'valor_mensalidade'), 20);
$$;

CREATE OR REPLACE FUNCTION public.garante_mensalidades_mes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref date := date_trunc('month', now())::date;
BEGIN
  INSERT INTO public.mensalidades (usuario_id, referencia, vencimento, valor)
  SELECT p.id, ref, (date_trunc('month', ref) + INTERVAL '9 days')::date, public.valor_mensalidade()
  FROM public.perfis p
  WHERE p.ativo
    AND EXISTS (
      SELECT 1 FROM public.papeis_usuario pu
      WHERE pu.user_id = p.id AND pu.papel IN ('associado','administrador')
    )
  ON CONFLICT (usuario_id, referencia) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.garante_mensalidade(_usuario_id uuid, _referencia date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref date := date_trunc('month', _referencia)::date; achado uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.papeis_usuario pu
    WHERE pu.user_id = _usuario_id AND pu.papel IN ('associado','administrador')
  ) THEN
    RAISE EXCEPTION 'Somente associados têm mensalidade';
  END IF;

  INSERT INTO public.mensalidades (usuario_id, referencia, vencimento, valor)
  VALUES (_usuario_id, ref, (date_trunc('month', ref) + INTERVAL '9 days')::date, public.valor_mensalidade())
  ON CONFLICT (usuario_id, referencia) DO NOTHING;

  SELECT id INTO achado FROM public.mensalidades
   WHERE usuario_id = _usuario_id AND referencia = ref;
  RETURN achado;
END;
$$;

-- 2. Avatar
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.perfis_publicos ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE OR REPLACE FUNCTION public.sincroniza_perfil_publico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.perfis_publicos (id, nome, posicao, ativo, time_coracao, avatar_url)
  VALUES (NEW.id, NEW.nome, NEW.posicao, NEW.ativo, NEW.time_coracao, NEW.avatar_url)
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    posicao = EXCLUDED.posicao,
    ativo = EXCLUDED.ativo,
    time_coracao = EXCLUDED.time_coracao,
    avatar_url = EXCLUDED.avatar_url;
  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS "Associados veem avatares" ON storage.objects;
CREATE POLICY "Associados veem avatares" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatares');
DROP POLICY IF EXISTS "Usuario envia proprio avatar" ON storage.objects;
CREATE POLICY "Usuario envia proprio avatar" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatares' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Usuario atualiza proprio avatar" ON storage.objects;
CREATE POLICY "Usuario atualiza proprio avatar" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatares' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatares' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Usuario apaga proprio avatar" ON storage.objects;
CREATE POLICY "Usuario apaga proprio avatar" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatares' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 3. Telefone do convidado sai de presencas (correção de exposição de dados)
CREATE TABLE IF NOT EXISTS public.presencas_contato (
  presenca_id uuid PRIMARY KEY REFERENCES public.presencas(id) ON DELETE CASCADE,
  telefone text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presencas_contato TO authenticated;
GRANT ALL ON public.presencas_contato TO service_role;
ALTER TABLE public.presencas_contato ENABLE ROW LEVEL SECURITY;

INSERT INTO public.presencas_contato (presenca_id, telefone)
SELECT id, telefone_convidado FROM public.presencas
WHERE telefone_convidado IS NOT NULL AND telefone_convidado <> ''
ON CONFLICT (presenca_id) DO NOTHING;

DROP POLICY IF EXISTS "Envolvidos leem contato do convidado" ON public.presencas_contato;
CREATE POLICY "Envolvidos leem contato do convidado" ON public.presencas_contato FOR SELECT TO authenticated
  USING (
    public.tem_papel(auth.uid(), 'administrador') OR EXISTS (
      SELECT 1 FROM public.presencas p
      WHERE p.id = presencas_contato.presenca_id
        AND (p.usuario_id = auth.uid() OR p.convidado_user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "Anfitriao ou diretoria gravam contato" ON public.presencas_contato;
CREATE POLICY "Anfitriao ou diretoria gravam contato" ON public.presencas_contato FOR ALL TO authenticated
  USING (
    public.tem_papel(auth.uid(), 'administrador') OR EXISTS (
      SELECT 1 FROM public.presencas p WHERE p.id = presencas_contato.presenca_id AND p.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    public.tem_papel(auth.uid(), 'administrador') OR EXISTS (
      SELECT 1 FROM public.presencas p WHERE p.id = presencas_contato.presenca_id AND p.usuario_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.cria_perfil_novo_usuario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tel text;
BEGIN
  tel := COALESCE(NEW.raw_user_meta_data ->> 'telefone', '');
  INSERT INTO public.perfis (id, nome, email, telefone, posicao)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    tel,
    COALESCE((NEW.raw_user_meta_data ->> 'posicao')::public.posicao_jogador, 'linha')
  );
  INSERT INTO public.papeis_usuario (user_id, papel) VALUES (NEW.id, 'convidado');

  IF tel <> '' THEN
    UPDATE public.presencas p
       SET convidado_user_id = NEW.id
      FROM public.presencas_contato c
     WHERE c.presenca_id = p.id AND c.telefone = tel AND p.convidado_user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

ALTER TABLE public.presencas DROP COLUMN IF EXISTS telefone_convidado;

-- 4. Notificações com link e alertas para a diretoria
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS link text;

CREATE OR REPLACE FUNCTION public.notifica(_usuario_id uuid, _tipo text, _titulo text, _mensagem text, _link text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
  VALUES (_usuario_id, _tipo, _titulo, _mensagem, _link);
$$;

CREATE OR REPLACE FUNCTION public.notifica_admins(_tipo text, _titulo text, _mensagem text, _link text DEFAULT NULL)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem, link)
  SELECT pu.user_id, _tipo, _titulo, _mensagem, _link
  FROM public.papeis_usuario pu WHERE pu.papel = 'administrador';
$$;

CREATE OR REPLACE FUNCTION public.audita_perfil()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.nome IS DISTINCT FROM OLD.nome
     OR NEW.telefone IS DISTINCT FROM OLD.telefone
     OR NEW.time_coracao IS DISTINCT FROM OLD.time_coracao THEN
    PERFORM public.notifica_admins('auditoria', 'Cadastro alterado',
      COALESCE(NEW.nome, 'Um jogador') || ' atualizou os dados do perfil.', '/admin/usuarios');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_audita_perfil ON public.perfis;
CREATE TRIGGER trg_audita_perfil AFTER UPDATE ON public.perfis
FOR EACH ROW EXECUTE FUNCTION public.audita_perfil();

CREATE OR REPLACE FUNCTION public.audita_presenca()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE quem text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    quem := COALESCE(NEW.nome_convidado, (SELECT nome FROM public.perfis WHERE id = NEW.usuario_id), 'Jogador');
    PERFORM public.notifica_admins('lista', 'Entrou na lista', quem || ' entrou na lista do baba.', '/baba');
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    quem := COALESCE(OLD.nome_convidado, (SELECT nome FROM public.perfis WHERE id = OLD.usuario_id), 'Jogador');
    PERFORM public.notifica_admins('lista', 'Saiu da lista', quem || ' saiu da lista do baba.', '/baba');
    RETURN OLD;
  ELSE
    IF NEW.ordem_chegada IS DISTINCT FROM OLD.ordem_chegada AND NEW.ordem_chegada IS NOT NULL THEN
      quem := COALESCE(NEW.nome_convidado, (SELECT nome FROM public.perfis WHERE id = NEW.usuario_id), 'Jogador');
      PERFORM public.notifica_admins('lista', 'Chegada confirmada',
        quem || ' marcou chegada na arena (' || NEW.ordem_chegada || 'º).', '/baba');
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
DROP TRIGGER IF EXISTS trg_audita_presenca ON public.presencas;
CREATE TRIGGER trg_audita_presenca AFTER INSERT OR UPDATE OR DELETE ON public.presencas
FOR EACH ROW EXECUTE FUNCTION public.audita_presenca();

CREATE OR REPLACE FUNCTION public.notifica_pagamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE quem text;
BEGIN
  IF NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago' THEN
    PERFORM public.notifica(NEW.usuario_id, 'pagamento', 'Pagamento confirmado',
      'Sua mensalidade de ' || to_char(NEW.referencia, 'MM/YYYY') || ' foi confirmada. Check-in liberado!', '/pagamentos');
    SELECT nome INTO quem FROM public.perfis WHERE id = NEW.usuario_id;
    PERFORM public.notifica_admins('pagamento', 'Mensalidade paga',
      COALESCE(quem, 'Um associado') || ' quitou a mensalidade de ' || to_char(NEW.referencia, 'MM/YYYY') || '.',
      '/admin/financeiro');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notifica_solicitacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nome_solic text;
BEGIN
  SELECT nome INTO nome_solic FROM public.perfis WHERE id = NEW.solicitante_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notifica(NEW.anfitriao_id, 'convidado', 'Nova solicitação de convidado',
      COALESCE(nome_solic, 'Um convidado') || ' pediu para entrar na lista como seu convidado.', '/baba');
    PERFORM public.notifica_admins('convidado', 'Nova solicitação de convidado',
      COALESCE(nome_solic, 'Um convidado') || ' pediu convite a um associado.', '/baba');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'pendente' THEN
      PERFORM public.notifica(NEW.anfitriao_id, 'convidado', 'Nova solicitação de convidado',
        COALESCE(nome_solic, 'Um convidado') || ' pediu para entrar na lista como seu convidado.', '/baba');
    ELSIF NEW.status = 'aprovado' THEN
      PERFORM public.notifica(NEW.solicitante_id, 'convidado', 'Solicitação aceita!',
        'Seu anfitrião aceitou. Gere e pague o PIX para confirmar sua vaga.', '/baba');
    ELSIF NEW.status = 'rejeitado' THEN
      PERFORM public.notifica(NEW.solicitante_id, 'convidado', 'Solicitação recusada',
        'Seu pedido de convite não foi aceito desta vez. Tente outro associado.', '/baba');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notifica_associacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE nome_solic text;
BEGIN
  SELECT nome INTO nome_solic FROM public.perfis WHERE id = NEW.usuario_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notifica_admins('associacao', 'Novo pedido de associação',
      COALESCE(nome_solic, 'Um convidado') || ' quer virar associado do baba.', '/admin/cargos');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'aprovado' THEN
      PERFORM public.notifica(NEW.usuario_id, 'associacao', 'Bem-vindo, Associado!',
        'Sua associação foi aprovada pela diretoria.', '/perfil');
    ELSIF NEW.status = 'rejeitado' THEN
      PERFORM public.notifica(NEW.usuario_id, 'associacao', 'Pedido de associação recusado',
        'A diretoria não aprovou seu pedido desta vez.', '/perfil');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Check-in por GPS encerra 1 hora após o início do baba
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

-- 6. Convites recusados podem ser refeitos (evita duplicate key)
CREATE OR REPLACE FUNCTION public.solicita_convite(_baba_id uuid, _anfitriao_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE achado public.solicitacoes_convidado%ROWTYPE; novo uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

  SELECT * INTO achado FROM public.solicitacoes_convidado
   WHERE baba_id = _baba_id AND solicitante_id = auth.uid()
   ORDER BY criado_em DESC LIMIT 1;

  IF FOUND THEN
    IF achado.status = 'pendente' THEN
      RAISE EXCEPTION 'Você já tem uma solicitação em aberto para esse baba';
    ELSIF achado.status = 'aprovado' THEN
      RAISE EXCEPTION 'Seu convite para esse baba já foi aceito';
    END IF;
    UPDATE public.solicitacoes_convidado
       SET status = 'pendente', anfitriao_id = _anfitriao_id, presenca_id = NULL, criado_em = now()
     WHERE id = achado.id;
    RETURN achado.id;
  END IF;

  INSERT INTO public.solicitacoes_convidado (baba_id, solicitante_id, anfitriao_id)
  VALUES (_baba_id, auth.uid(), _anfitriao_id)
  RETURNING id INTO novo;
  RETURN novo;
END;
$$;
REVOKE ALL ON FUNCTION public.solicita_convite(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.solicita_convite(uuid, uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.valor_mensalidade() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.valor_mensalidade() TO authenticated;

DROP TRIGGER IF EXISTS trg_notifica_solicitacao ON public.solicitacoes_convidado;
CREATE TRIGGER trg_notifica_solicitacao AFTER INSERT OR UPDATE ON public.solicitacoes_convidado
FOR EACH ROW EXECUTE FUNCTION public.notifica_solicitacao();