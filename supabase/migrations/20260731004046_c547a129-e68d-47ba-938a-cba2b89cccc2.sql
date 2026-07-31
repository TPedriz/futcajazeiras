
CREATE TABLE public.convidados_cadastro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  telefone text NOT NULL UNIQUE,
  criado_por uuid REFERENCES auth.users ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users ON DELETE SET NULL,
  aprovado boolean NOT NULL DEFAULT false,
  bloqueado boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.convidados_cadastro TO authenticated;
GRANT ALL ON public.convidados_cadastro TO service_role;
ALTER TABLE public.convidados_cadastro ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Logados veem convidados cadastrados"
  ON public.convidados_cadastro FOR SELECT TO authenticated USING (true);
CREATE POLICY "Diretoria edita convidados"
  ON public.convidados_cadastro FOR UPDATE TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

CREATE TRIGGER convidados_cadastro_updated_at
  BEFORE UPDATE ON public.convidados_cadastro
  FOR EACH ROW EXECUTE FUNCTION public.atualiza_atualizado_em();

CREATE TABLE public.pedidos_convidado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baba_id uuid NOT NULL REFERENCES public.sessoes_baba ON DELETE CASCADE,
  anfitriao_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  convidado_id uuid NOT NULL REFERENCES public.convidados_cadastro ON DELETE CASCADE,
  status public.status_convidado NOT NULL DEFAULT 'pendente',
  presenca_id uuid REFERENCES public.presencas ON DELETE SET NULL,
  decidido_por uuid REFERENCES auth.users ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.pedidos_convidado TO authenticated;
GRANT ALL ON public.pedidos_convidado TO service_role;
ALTER TABLE public.pedidos_convidado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anfitriao e diretoria veem pedidos"
  ON public.pedidos_convidado FOR SELECT TO authenticated
  USING (anfitriao_id = auth.uid() OR public.tem_papel(auth.uid(), 'administrador'));
CREATE POLICY "Diretoria decide pedidos"
  ON public.pedidos_convidado FOR UPDATE TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

CREATE TRIGGER pedidos_convidado_updated_at
  BEFORE UPDATE ON public.pedidos_convidado
  FOR EACH ROW EXECUTE FUNCTION public.atualiza_atualizado_em();

ALTER TABLE public.presencas
  ADD COLUMN IF NOT EXISTS convidado_cadastro_id uuid REFERENCES public.convidados_cadastro ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.criar_pedido_convidado(_baba_id uuid, _nome text, _telefone text, _convidado_id uuid DEFAULT NULL)
RETURNS TABLE (pedido_id uuid, status public.status_convidado, convidado_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  cad public.convidados_cadastro%ROWTYPE;
  novo_status public.status_convidado;
  novo_pedido uuid;
  tel text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT (public.tem_papel(auth.uid(), 'associado') OR public.tem_papel(auth.uid(), 'administrador')) THEN
    RAISE EXCEPTION 'Somente associados podem levar convidados';
  END IF;

  IF _convidado_id IS NOT NULL THEN
    SELECT * INTO cad FROM public.convidados_cadastro WHERE id = _convidado_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Convidado não encontrado'; END IF;
  ELSE
    tel := regexp_replace(COALESCE(_telefone, ''), '\D', '', 'g');
    IF length(tel) < 10 THEN RAISE EXCEPTION 'Informe um WhatsApp válido'; END IF;
    IF length(COALESCE(btrim(_nome), '')) < 3 THEN RAISE EXCEPTION 'Informe o nome completo do convidado'; END IF;

    SELECT * INTO cad FROM public.convidados_cadastro WHERE telefone = tel;
    IF NOT FOUND THEN
      INSERT INTO public.convidados_cadastro (nome, telefone, criado_por)
      VALUES (btrim(_nome), tel, auth.uid())
      RETURNING * INTO cad;
    END IF;
  END IF;

  IF cad.bloqueado THEN RAISE EXCEPTION 'Esse convidado está bloqueado pela diretoria'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.pedidos_convidado
     WHERE baba_id = _baba_id AND pedidos_convidado.convidado_id = cad.id AND pedidos_convidado.status <> 'rejeitado'
  ) THEN
    RAISE EXCEPTION 'Esse convidado já foi solicitado para este baba';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pedidos_convidado
     WHERE baba_id = _baba_id AND anfitriao_id = auth.uid() AND pedidos_convidado.status <> 'rejeitado'
  ) THEN
    RAISE EXCEPTION 'Você já tem um convidado neste baba';
  END IF;

  novo_status := CASE WHEN cad.aprovado THEN 'aprovado'::public.status_convidado ELSE 'pendente'::public.status_convidado END;

  INSERT INTO public.pedidos_convidado (baba_id, anfitriao_id, convidado_id, status)
  VALUES (_baba_id, auth.uid(), cad.id, novo_status)
  RETURNING id INTO novo_pedido;

  IF novo_status = 'pendente' THEN
    INSERT INTO public.notificacoes (usuario_id, titulo, mensagem, link)
    SELECT pu.user_id, 'Novo convidado aguardando aprovação',
           cad.nome || ' foi indicado para o próximo baba.', '/admin/usuarios'
      FROM public.papeis_usuario pu WHERE pu.papel = 'administrador';
  END IF;

  RETURN QUERY SELECT novo_pedido, novo_status, cad.id;
END;
$$;

REVOKE ALL ON FUNCTION public.criar_pedido_convidado(uuid, text, text, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.criar_pedido_convidado(uuid, text, text, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.decidir_pedido_convidado(_pedido_id uuid, _aprovar boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE ped public.pedidos_convidado%ROWTYPE; cad public.convidados_cadastro%ROWTYPE;
BEGIN
  IF NOT public.tem_papel(auth.uid(), 'administrador') THEN RAISE EXCEPTION 'Apenas a diretoria decide'; END IF;
  SELECT * INTO ped FROM public.pedidos_convidado WHERE id = _pedido_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF ped.status <> 'pendente' THEN RAISE EXCEPTION 'Esse pedido já foi decidido'; END IF;
  SELECT * INTO cad FROM public.convidados_cadastro WHERE id = ped.convidado_id;

  UPDATE public.pedidos_convidado
     SET status = CASE WHEN _aprovar THEN 'aprovado'::public.status_convidado ELSE 'rejeitado'::public.status_convidado END,
         decidido_por = auth.uid()
   WHERE id = _pedido_id;

  IF _aprovar THEN
    UPDATE public.convidados_cadastro SET aprovado = true WHERE id = ped.convidado_id;
  END IF;

  INSERT INTO public.notificacoes (usuario_id, titulo, mensagem, link)
  VALUES (
    ped.anfitriao_id,
    CASE WHEN _aprovar THEN 'Convidado aprovado' ELSE 'Convidado recusado' END,
    CASE WHEN _aprovar THEN cad.nome || ' foi aprovado. Gere o PIX da diária para confirmar a vaga.'
         ELSE cad.nome || ' não foi aprovado pela diretoria.' END,
    '/baba'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.decidir_pedido_convidado(uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.decidir_pedido_convidado(uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.vincula_convidado_por_telefone()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE tel text;
BEGIN
  tel := regexp_replace(COALESCE(NEW.telefone, ''), '\D', '', 'g');
  IF length(tel) >= 10 THEN
    UPDATE public.convidados_cadastro SET user_id = NEW.id WHERE telefone = tel AND user_id IS DISTINCT FROM NEW.id;
    UPDATE public.presencas p
       SET convidado_user_id = NEW.id
      FROM public.convidados_cadastro c
     WHERE p.convidado_cadastro_id = c.id AND c.telefone = tel AND p.convidado_user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS perfis_vincula_convidado ON public.perfis;
CREATE TRIGGER perfis_vincula_convidado
  AFTER INSERT OR UPDATE OF telefone ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.vincula_convidado_por_telefone();

CREATE OR REPLACE FUNCTION public.babas_pagos_convidado(_user_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COUNT(DISTINCT p.id)::integer
    FROM public.presencas p
    LEFT JOIN public.convidados_cadastro c ON c.id = p.convidado_cadastro_id
   WHERE p.nome_convidado IS NOT NULL
     AND p.status_convidado = 'aprovado'
     AND (p.convidado_user_id = _user_id OR c.user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.define_fechamento_lista()
RETURNS trigger
LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE padrao timestamptz;
BEGIN
  padrao := LEAST(
    NEW.data_horario - INTERVAL '3 hours',
    date_trunc('day', NEW.data_horario AT TIME ZONE 'America/Bahia') AT TIME ZONE 'America/Bahia' - INTERVAL '2 hours'
  );

  IF TG_OP = 'INSERT' THEN
    IF NEW.fechamento_lista IS NULL THEN NEW.fechamento_lista := padrao; END IF;
  ELSE
    IF NEW.data_horario IS DISTINCT FROM OLD.data_horario
       AND NEW.fechamento_lista IS NOT DISTINCT FROM OLD.fechamento_lista THEN
      NEW.fechamento_lista := padrao;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.sessoes_baba ALTER COLUMN fechamento_lista DROP NOT NULL;
