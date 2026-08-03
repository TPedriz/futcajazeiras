-- 1. Nova coluna abertura_lista
ALTER TABLE public.sessoes_baba
  ADD COLUMN IF NOT EXISTS abertura_lista timestamptz;

-- 2. Backfill: 22h do dia anterior (America/Bahia)
UPDATE public.sessoes_baba
   SET abertura_lista = date_trunc('day', data_horario AT TIME ZONE 'America/Bahia')
                        AT TIME ZONE 'America/Bahia' - INTERVAL '2 hours'
 WHERE abertura_lista IS NULL;

-- 3. Trigger define_fechamento_lista: abertura e fechamento independentes
CREATE OR REPLACE FUNCTION public.define_fechamento_lista()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  fechamento_padrao timestamptz;
  abertura_padrao   timestamptz;
BEGIN
  fechamento_padrao := NEW.data_horario - INTERVAL '3 hours';
  abertura_padrao   := date_trunc('day', NEW.data_horario AT TIME ZONE 'America/Bahia')
                       AT TIME ZONE 'America/Bahia' - INTERVAL '2 hours';

  IF TG_OP = 'INSERT' THEN
    IF NEW.fechamento_lista IS NULL THEN NEW.fechamento_lista := fechamento_padrao; END IF;
    IF NEW.abertura_lista IS NULL THEN NEW.abertura_lista := abertura_padrao; END IF;
  ELSE
    IF NEW.data_horario IS DISTINCT FROM OLD.data_horario THEN
      IF NEW.fechamento_lista IS NOT DISTINCT FROM OLD.fechamento_lista THEN
        NEW.fechamento_lista := fechamento_padrao;
      END IF;
      IF NEW.abertura_lista IS NOT DISTINCT FROM OLD.abertura_lista THEN
        NEW.abertura_lista := abertura_padrao;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. valida_checkin: janela de lista ANTES do bypass de convidado
CREATE OR REPLACE FUNCTION public.valida_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  ref date := date_trunc('month', now())::date;
  venc date := (date_trunc('month', now()) + INTERVAL '9 days')::date;
  esta_pago boolean;
  eh_associado boolean;
  esta_ativo boolean;
  ses public.sessoes_baba%ROWTYPE;
BEGIN
  SELECT p.ativo INTO esta_ativo FROM public.perfis p WHERE p.id = NEW.usuario_id;
  IF COALESCE(esta_ativo, true) = false THEN
    RAISE EXCEPTION 'Conta desativada. Fale com a diretoria.';
  END IF;

  IF auth.uid() IS DISTINCT FROM NEW.usuario_id THEN RETURN NEW; END IF;

  SELECT * INTO ses FROM public.sessoes_baba WHERE id = NEW.baba_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Baba não encontrado.'; END IF;

  IF ses.esta_fechado THEN
    RAISE EXCEPTION 'A lista foi fechada pela diretoria.';
  END IF;
  IF now() < COALESCE(ses.abertura_lista, '1970-01-01'::timestamptz) THEN
    RAISE EXCEPTION 'A lista ainda não foi aberta para check-in.';
  END IF;
  IF now() >= COALESCE(ses.fechamento_lista, '9999-12-31'::timestamptz) THEN
    RAISE EXCEPTION 'A lista já foi encerrada.';
  END IF;

  IF NEW.nome_convidado IS NOT NULL THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.suspensoes s
    WHERE s.usuario_id = NEW.usuario_id AND s.baba_bloqueado_id = NEW.baba_id
  ) THEN
    RAISE EXCEPTION 'Você está suspenso por cartão vermelho e não pode entrar na lista deste baba.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.papeis_usuario pu
    WHERE pu.user_id = NEW.usuario_id AND pu.papel IN ('associado','administrador')
  ) INTO eh_associado;

  IF eh_associado AND now()::date > venc THEN
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

-- 5. Bloqueio de cancelamento após o fechamento
CREATE OR REPLACE FUNCTION public.bloqueia_cancelamento_lista()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  ses public.sessoes_baba%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RETURN OLD; END IF;
  IF public.tem_papel(auth.uid(), 'administrador') THEN RETURN OLD; END IF;
  IF auth.uid() IS DISTINCT FROM OLD.usuario_id THEN RETURN OLD; END IF;
  IF OLD.nome_convidado IS NOT NULL THEN RETURN OLD; END IF;

  SELECT * INTO ses FROM public.sessoes_baba WHERE id = OLD.baba_id;
  IF NOT FOUND THEN RETURN OLD; END IF;

  IF ses.esta_fechado OR now() >= COALESCE(ses.fechamento_lista, '9999-12-31'::timestamptz) THEN
    RAISE EXCEPTION 'A lista já está fechada e não é possível desistir. Fale com a diretoria.';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_bloqueia_cancelamento ON public.presencas;
CREATE TRIGGER trg_bloqueia_cancelamento
BEFORE DELETE ON public.presencas
FOR EACH ROW EXECUTE FUNCTION public.bloqueia_cancelamento_lista();