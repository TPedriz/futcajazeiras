-- 1. Vencimento no dia 10
CREATE OR REPLACE FUNCTION public.define_vencimento_mensalidade()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.referencia := date_trunc('month', NEW.referencia)::date;
  NEW.vencimento := (date_trunc('month', NEW.referencia) + INTERVAL '9 days')::date;
  IF NEW.status = 'pago' AND NEW.pago_em IS NULL THEN
    NEW.pago_em := now();
  ELSIF NEW.status = 'pendente' THEN
    NEW.pago_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.garante_mensalidades_mes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ref date := date_trunc('month', now())::date;
BEGIN
  INSERT INTO public.mensalidades (usuario_id, referencia, vencimento)
  SELECT p.id, ref, (date_trunc('month', ref) + INTERVAL '9 days')::date
  FROM public.perfis p
  ON CONFLICT (usuario_id, referencia) DO NOTHING;
END;
$$;

UPDATE public.mensalidades
SET vencimento = (date_trunc('month', referencia) + INTERVAL '9 days')::date
WHERE vencimento <> (date_trunc('month', referencia) + INTERVAL '9 days')::date;

-- 2. Notificações
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  tipo text NOT NULL DEFAULT 'geral',
  titulo text NOT NULL,
  mensagem text NOT NULL DEFAULT '',
  lida boolean NOT NULL DEFAULT false,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuario le proprias notificacoes" ON public.notificacoes;
CREATE POLICY "Usuario le proprias notificacoes" ON public.notificacoes
  FOR SELECT TO authenticated USING (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "Usuario marca propria notificacao" ON public.notificacoes;
CREATE POLICY "Usuario marca propria notificacao" ON public.notificacoes
  FOR UPDATE TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
DROP POLICY IF EXISTS "Usuario apaga propria notificacao" ON public.notificacoes;
CREATE POLICY "Usuario apaga propria notificacao" ON public.notificacoes
  FOR DELETE TO authenticated USING (auth.uid() = usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_usuario ON public.notificacoes (usuario_id, criado_em DESC);

ALTER TABLE public.notificacoes REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.notifica(_usuario_id uuid, _tipo text, _titulo text, _mensagem text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  INSERT INTO public.notificacoes (usuario_id, tipo, titulo, mensagem)
  VALUES (_usuario_id, _tipo, _titulo, _mensagem);
$$;
REVOKE ALL ON FUNCTION public.notifica(uuid, text, text, text) FROM PUBLIC, anon, authenticated;

-- 3. Suspensões
CREATE TABLE IF NOT EXISTS public.suspensoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  baba_origem_id uuid REFERENCES public.sessoes_baba(id) ON DELETE CASCADE,
  baba_bloqueado_id uuid REFERENCES public.sessoes_baba(id) ON DELETE SET NULL,
  motivo text NOT NULL DEFAULT 'Cartão vermelho',
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, baba_origem_id)
);
GRANT SELECT ON public.suspensoes TO authenticated;
GRANT ALL ON public.suspensoes TO service_role;
ALTER TABLE public.suspensoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Todos leem suspensoes" ON public.suspensoes;
CREATE POLICY "Todos leem suspensoes" ON public.suspensoes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin gerencia suspensoes" ON public.suspensoes;
CREATE POLICY "Admin gerencia suspensoes" ON public.suspensoes FOR ALL TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));
GRANT INSERT, UPDATE, DELETE ON public.suspensoes TO authenticated;

CREATE OR REPLACE FUNCTION public.aplica_suspensao_vermelho()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  prox uuid;
  data_origem timestamptz;
  nova_susp uuid;
BEGIN
  IF NEW.cartoes_vermelhos > COALESCE(OLD.cartoes_vermelhos, 0) THEN
    SELECT data_horario INTO data_origem FROM public.sessoes_baba WHERE id = NEW.baba_id;
    SELECT id INTO prox FROM public.sessoes_baba
      WHERE data_horario > data_origem ORDER BY data_horario ASC LIMIT 1;
    INSERT INTO public.suspensoes (usuario_id, baba_origem_id, baba_bloqueado_id, motivo)
    VALUES (NEW.usuario_id, NEW.baba_id, prox,
      'Suspenso por cartão vermelho no baba do dia ' || to_char(data_origem AT TIME ZONE 'America/Fortaleza', 'DD/MM/YYYY'))
    ON CONFLICT (usuario_id, baba_origem_id) DO NOTHING
    RETURNING id INTO nova_susp;

    IF nova_susp IS NOT NULL THEN
      PERFORM public.notifica(NEW.usuario_id, 'suspensao', 'Suspensão por cartão vermelho',
        'Você recebeu cartão vermelho no baba do dia ' ||
        to_char(data_origem AT TIME ZONE 'America/Fortaleza', 'DD/MM/YYYY') ||
        ' e está suspenso do próximo baba.');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_suspensao_vermelho ON public.estatisticas_baba;
CREATE TRIGGER trg_suspensao_vermelho
AFTER INSERT OR UPDATE OF cartoes_vermelhos ON public.estatisticas_baba
FOR EACH ROW EXECUTE FUNCTION public.aplica_suspensao_vermelho();

-- 4. Bloqueio de check-in (inadimplência + suspensão)
CREATE OR REPLACE FUNCTION public.valida_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  ref date := date_trunc('month', now())::date;
  venc date := (date_trunc('month', now()) + INTERVAL '9 days')::date;
  esta_pago boolean;
BEGIN
  IF NEW.nome_convidado IS NOT NULL THEN RETURN NEW; END IF;
  IF auth.uid() IS DISTINCT FROM NEW.usuario_id THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.suspensoes s
    WHERE s.usuario_id = NEW.usuario_id AND s.baba_bloqueado_id = NEW.baba_id
  ) THEN
    RAISE EXCEPTION 'Você está suspenso por cartão vermelho e não pode entrar na lista deste baba.';
  END IF;

  IF now()::date > venc THEN
    SELECT (m.status = 'pago') INTO esta_pago
      FROM public.mensalidades m
      WHERE m.usuario_id = NEW.usuario_id AND m.referencia = ref;
    IF COALESCE(esta_pago, false) = false THEN
      RAISE EXCEPTION 'Mensalidade em aberto desde o dia 10. Pague o PIX para liberar seu check-in.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_valida_checkin ON public.presencas;
CREATE TRIGGER trg_valida_checkin BEFORE INSERT ON public.presencas
FOR EACH ROW EXECUTE FUNCTION public.valida_checkin();

-- 5. Notificações automáticas de solicitações e pagamentos
CREATE OR REPLACE FUNCTION public.notifica_solicitacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE nome_solic text;
BEGIN
  SELECT nome INTO nome_solic FROM public.perfis WHERE id = NEW.solicitante_id;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.notifica(NEW.anfitriao_id, 'convidado', 'Nova solicitação de convidado',
      COALESCE(nome_solic, 'Um convidado') || ' pediu para entrar na lista como seu convidado.');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'aprovado' THEN
      PERFORM public.notifica(NEW.solicitante_id, 'convidado', 'Solicitação aceita!',
        'Seu anfitrião aceitou. Gere e pague o PIX para confirmar sua vaga.');
    ELSIF NEW.status = 'rejeitado' THEN
      PERFORM public.notifica(NEW.solicitante_id, 'convidado', 'Solicitação recusada',
        'Seu pedido de convite não foi aceito desta vez. Tente outro associado.');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notifica_solicitacao ON public.solicitacoes_convidado;
CREATE TRIGGER trg_notifica_solicitacao
AFTER INSERT OR UPDATE ON public.solicitacoes_convidado
FOR EACH ROW EXECUTE FUNCTION public.notifica_solicitacao();

CREATE OR REPLACE FUNCTION public.notifica_pagamento()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago' THEN
    PERFORM public.notifica(NEW.usuario_id, 'pagamento', 'Pagamento confirmado',
      'Sua mensalidade de ' || to_char(NEW.referencia, 'MM/YYYY') || ' foi confirmada. Check-in liberado!');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_notifica_pagamento ON public.mensalidades;
CREATE TRIGGER trg_notifica_pagamento AFTER UPDATE ON public.mensalidades
FOR EACH ROW EXECUTE FUNCTION public.notifica_pagamento();

-- 6. Garantir triggers base existentes
DROP TRIGGER IF EXISTS trg_vencimento_mensalidade ON public.mensalidades;
CREATE TRIGGER trg_vencimento_mensalidade BEFORE INSERT OR UPDATE ON public.mensalidades
FOR EACH ROW EXECUTE FUNCTION public.define_vencimento_mensalidade();

DROP TRIGGER IF EXISTS trg_sincroniza_status_perfil ON public.mensalidades;
CREATE TRIGGER trg_sincroniza_status_perfil AFTER INSERT OR UPDATE ON public.mensalidades
FOR EACH ROW EXECUTE FUNCTION public.sincroniza_status_perfil();

DROP TRIGGER IF EXISTS trg_fechamento_lista ON public.sessoes_baba;
CREATE TRIGGER trg_fechamento_lista BEFORE INSERT OR UPDATE ON public.sessoes_baba
FOR EACH ROW EXECUTE FUNCTION public.define_fechamento_lista();

DROP TRIGGER IF EXISTS trg_sincroniza_perfil_publico ON public.perfis;
CREATE TRIGGER trg_sincroniza_perfil_publico AFTER INSERT OR UPDATE ON public.perfis
FOR EACH ROW EXECUTE FUNCTION public.sincroniza_perfil_publico();

DROP TRIGGER IF EXISTS trg_perfis_atualizado ON public.perfis;
CREATE TRIGGER trg_perfis_atualizado BEFORE UPDATE ON public.perfis
FOR EACH ROW EXECUTE FUNCTION public.atualiza_atualizado_em();