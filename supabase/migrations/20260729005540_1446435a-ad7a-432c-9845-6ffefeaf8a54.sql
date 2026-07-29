
ALTER TABLE public.sessoes_baba
  ADD COLUMN IF NOT EXISTS latitude double precision NOT NULL DEFAULT -12.9088,
  ADD COLUMN IF NOT EXISTS longitude double precision NOT NULL DEFAULT -38.4142,
  ADD COLUMN IF NOT EXISTS raio_metros integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS mostrar_lista_chegada boolean NOT NULL DEFAULT false;

CREATE POLICY "Convidado marca a propria chegada"
ON public.presencas FOR UPDATE TO authenticated
USING (auth.uid() = convidado_user_id)
WITH CHECK (auth.uid() = convidado_user_id);

CREATE OR REPLACE FUNCTION public.marcar_chegada(_presenca_id uuid, _lat double precision, _lng double precision)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
  limite := (date_trunc('day', ses.data_horario AT TIME ZONE 'America/Fortaleza') + INTERVAL '20 hours 30 minutes')
              AT TIME ZONE 'America/Fortaleza';

  IF NOT public.tem_papel(auth.uid(), 'administrador') THEN
    IF now() < abertura THEN
      RAISE EXCEPTION 'A marcação de chegada abre 30 minutos antes do baba.';
    END IF;
    IF now() > limite THEN
      RAISE EXCEPTION 'A marcação de chegada encerrou às 20:30.';
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

REVOKE ALL ON FUNCTION public.marcar_chegada(uuid, double precision, double precision) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_chegada(uuid, double precision, double precision) TO authenticated;
