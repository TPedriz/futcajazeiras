-- ========== 1. Novos tipos ==========
DO $$ BEGIN
  CREATE TYPE public.time_coracao AS ENUM ('bahia','vitoria');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.status_solicitacao_assoc AS ENUM ('pendente','aprovado','rejeitado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== 2. Perfis: ativo + time do coração ==========
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS time_coracao public.time_coracao;

ALTER TABLE public.perfis_publicos
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS time_coracao public.time_coracao;

CREATE OR REPLACE FUNCTION public.sincroniza_perfil_publico()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.perfis_publicos (id, nome, posicao, ativo, time_coracao)
  VALUES (NEW.id, NEW.nome, NEW.posicao, NEW.ativo, NEW.time_coracao)
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    posicao = EXCLUDED.posicao,
    ativo = EXCLUDED.ativo,
    time_coracao = EXCLUDED.time_coracao;
  RETURN NEW;
END;
$$;

UPDATE public.perfis_publicos pp
SET ativo = p.ativo, time_coracao = p.time_coracao
FROM public.perfis p WHERE p.id = pp.id;

-- ========== 3. Presenças: chegada, chamada, convidado por WhatsApp ==========
ALTER TABLE public.presencas
  ADD COLUMN IF NOT EXISTS telefone_convidado text,
  ADD COLUMN IF NOT EXISTS convidado_user_id uuid,
  ADD COLUMN IF NOT EXISTS chegou_em timestamptz,
  ADD COLUMN IF NOT EXISTS ordem_chegada integer,
  ADD COLUMN IF NOT EXISTS compareceu boolean;

CREATE INDEX IF NOT EXISTS presencas_convidado_user_idx ON public.presencas(convidado_user_id);
CREATE INDEX IF NOT EXISTS presencas_telefone_idx ON public.presencas(telefone_convidado);

-- ========== 4. Dados sensíveis de PIX das presenças em tabela separada ==========
CREATE TABLE IF NOT EXISTS public.presencas_pagamento (
  presenca_id uuid PRIMARY KEY REFERENCES public.presencas(id) ON DELETE CASCADE,
  mp_payment_id text,
  pix_qr_code text,
  pix_qr_base64 text,
  pix_expira_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presencas_pagamento TO authenticated;
GRANT ALL ON public.presencas_pagamento TO service_role;
ALTER TABLE public.presencas_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono ou diretoria leem cobranca da presenca"
ON public.presencas_pagamento FOR SELECT TO authenticated
USING (
  public.tem_papel(auth.uid(), 'administrador')
  OR EXISTS (
    SELECT 1 FROM public.presencas p
    WHERE p.id = presencas_pagamento.presenca_id
      AND (p.usuario_id = auth.uid() OR p.convidado_user_id = auth.uid())
  )
);

CREATE POLICY "Diretoria gerencia cobranca da presenca"
ON public.presencas_pagamento FOR ALL TO authenticated
USING (public.tem_papel(auth.uid(), 'administrador'))
WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

CREATE TRIGGER presencas_pagamento_atualizado_em
BEFORE UPDATE ON public.presencas_pagamento
FOR EACH ROW EXECUTE FUNCTION public.atualiza_atualizado_em();

INSERT INTO public.presencas_pagamento (presenca_id, mp_payment_id, pix_qr_code, pix_qr_base64, pix_expira_em)
SELECT id, mp_payment_id, pix_qr_code, pix_qr_base64, pix_expira_em
FROM public.presencas
WHERE mp_payment_id IS NOT NULL OR pix_qr_code IS NOT NULL
ON CONFLICT (presenca_id) DO NOTHING;

ALTER TABLE public.presencas
  DROP COLUMN IF EXISTS mp_payment_id,
  DROP COLUMN IF EXISTS pix_qr_code,
  DROP COLUMN IF EXISTS pix_qr_base64,
  DROP COLUMN IF EXISTS pix_expira_em;

-- ========== 5. Assistências ==========
ALTER TABLE public.estatisticas_baba
  ADD COLUMN IF NOT EXISTS assistencias integer NOT NULL DEFAULT 0;

DROP VIEW IF EXISTS public.ranking_mensal;
CREATE VIEW public.ranking_mensal AS
WITH gols AS (
  SELECT (date_trunc('month', s.data_horario))::date AS mes,
         e.usuario_id,
         (sum(e.gols))::integer AS gols,
         (sum(e.assistencias))::integer AS assistencias,
         (sum(e.cartoes_amarelos))::integer AS cartoes_amarelos,
         (sum(e.cartoes_azuis))::integer AS cartoes_azuis,
         (sum(e.cartoes_vermelhos))::integer AS cartoes_vermelhos
  FROM public.estatisticas_baba e
  JOIN public.sessoes_baba s ON s.id = e.baba_id
  GROUP BY 1, 2
), resultados AS (
  SELECT (date_trunc('month', s.data_horario))::date AS mes,
         tj.usuario_id,
         (count(*) FILTER (WHERE t.resultado = 'vitoria'))::integer AS vitorias,
         (count(*) FILTER (WHERE t.resultado = 'derrota'))::integer AS derrotas,
         (count(*) FILTER (WHERE t.resultado = 'empate'))::integer AS empates
  FROM public.times_jogadores tj
  JOIN public.times_baba t ON t.id = tj.time_id
  JOIN public.sessoes_baba s ON s.id = t.baba_id
  WHERE tj.usuario_id IS NOT NULL
  GROUP BY 1, 2
)
SELECT COALESCE(g.mes, r.mes) AS mes,
       COALESCE(g.usuario_id, r.usuario_id) AS usuario_id,
       p.nome,
       p.posicao,
       COALESCE(g.gols, 0) AS gols,
       COALESCE(g.assistencias, 0) AS assistencias,
       COALESCE(g.cartoes_amarelos, 0) AS cartoes_amarelos,
       COALESCE(g.cartoes_azuis, 0) AS cartoes_azuis,
       COALESCE(g.cartoes_vermelhos, 0) AS cartoes_vermelhos,
       COALESCE(r.vitorias, 0) AS vitorias,
       COALESCE(r.derrotas, 0) AS derrotas,
       COALESCE(r.empates, 0) AS empates
FROM gols g
FULL JOIN resultados r ON r.mes = g.mes AND r.usuario_id = g.usuario_id
JOIN public.perfis_publicos p ON p.id = COALESCE(g.usuario_id, r.usuario_id);

-- ========== 6. Mensalidade R$ 20 e isenção de convidado ==========
ALTER TABLE public.mensalidades ALTER COLUMN valor SET DEFAULT 20;
UPDATE public.mensalidades SET valor = 20 WHERE status = 'pendente' AND valor = 15;

CREATE OR REPLACE FUNCTION public.garante_mensalidades_mes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ref date := date_trunc('month', now())::date;
BEGIN
  INSERT INTO public.mensalidades (usuario_id, referencia, vencimento, valor)
  SELECT p.id, ref, (date_trunc('month', ref) + INTERVAL '9 days')::date, 20
  FROM public.perfis p
  WHERE p.ativo
    AND EXISTS (
      SELECT 1 FROM public.papeis_usuario pu
      WHERE pu.user_id = p.id AND pu.papel IN ('associado','administrador')
    )
  ON CONFLICT (usuario_id, referencia) DO NOTHING;
END;
$$;

-- Cria (ou devolve) a mensalidade de um mês específico: pagamento adiantado e presente
CREATE OR REPLACE FUNCTION public.garante_mensalidade(_usuario_id uuid, _referencia date)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
  VALUES (_usuario_id, ref, (date_trunc('month', ref) + INTERVAL '9 days')::date, 20)
  ON CONFLICT (usuario_id, referencia) DO NOTHING;

  SELECT id INTO achado FROM public.mensalidades
   WHERE usuario_id = _usuario_id AND referencia = ref;
  RETURN achado;
END;
$$;

REVOKE ALL ON FUNCTION public.garante_mensalidade(uuid, date) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.garante_mensalidade(uuid, date) TO authenticated;

-- ========== 7. Vínculo do histórico de convidado pelo WhatsApp ==========
CREATE OR REPLACE FUNCTION public.cria_perfil_novo_usuario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    UPDATE public.presencas
       SET convidado_user_id = NEW.id
     WHERE telefone_convidado = tel AND convidado_user_id IS NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Quantos babas o convidado já pagou/participou
CREATE OR REPLACE FUNCTION public.babas_pagos_convidado(_user_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COUNT(*)::integer FROM public.presencas p
  WHERE p.convidado_user_id = _user_id
    AND p.nome_convidado IS NOT NULL
    AND p.status_convidado = 'aprovado';
$$;

REVOKE ALL ON FUNCTION public.babas_pagos_convidado(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.babas_pagos_convidado(uuid) TO authenticated;

-- ========== 8. Solicitações de associação + limite de 50 ==========
CREATE TABLE IF NOT EXISTS public.solicitacoes_associacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  status public.status_solicitacao_assoc NOT NULL DEFAULT 'pendente',
  decidido_por uuid,
  observacao text NOT NULL DEFAULT '',
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes_associacao TO authenticated;
GRANT ALL ON public.solicitacoes_associacao TO service_role;
ALTER TABLE public.solicitacoes_associacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario le a propria solicitacao de associacao"
ON public.solicitacoes_associacao FOR SELECT TO authenticated
USING (auth.uid() = usuario_id OR public.tem_papel(auth.uid(), 'administrador'));

CREATE POLICY "Usuario cria a propria solicitacao de associacao"
ON public.solicitacoes_associacao FOR INSERT TO authenticated
WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY "Diretoria decide solicitacao de associacao"
ON public.solicitacoes_associacao FOR UPDATE TO authenticated
USING (public.tem_papel(auth.uid(), 'administrador'))
WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

CREATE POLICY "Solicitante ou diretoria removem solicitacao de associacao"
ON public.solicitacoes_associacao FOR DELETE TO authenticated
USING (auth.uid() = usuario_id OR public.tem_papel(auth.uid(), 'administrador'));

CREATE TRIGGER solicitacoes_associacao_atualizado_em
BEFORE UPDATE ON public.solicitacoes_associacao
FOR EACH ROW EXECUTE FUNCTION public.atualiza_atualizado_em();

CREATE OR REPLACE FUNCTION public.total_associados_ativos()
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT COUNT(DISTINCT pu.user_id)::integer
  FROM public.papeis_usuario pu
  JOIN public.perfis p ON p.id = pu.user_id
  WHERE pu.papel IN ('associado','administrador') AND p.ativo;
$$;

REVOKE ALL ON FUNCTION public.total_associados_ativos() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.total_associados_ativos() TO authenticated;

CREATE OR REPLACE FUNCTION public.limita_associados()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.papel IN ('associado','administrador') THEN
    IF public.total_associados_ativos() >= 50 THEN
      RAISE EXCEPTION 'Limite de 50 associados ativos atingido. Desative alguém antes de aprovar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS limita_associados_trg ON public.papeis_usuario;
CREATE TRIGGER limita_associados_trg
BEFORE INSERT ON public.papeis_usuario
FOR EACH ROW EXECUTE FUNCTION public.limita_associados();

-- ========== 9. Check-in: convidado isento de mensalidade, inativo bloqueado ==========
CREATE OR REPLACE FUNCTION public.valida_checkin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  ref date := date_trunc('month', now())::date;
  venc date := (date_trunc('month', now()) + INTERVAL '9 days')::date;
  esta_pago boolean;
  eh_associado boolean;
  esta_ativo boolean;
BEGIN
  SELECT p.ativo INTO esta_ativo FROM public.perfis p WHERE p.id = NEW.usuario_id;
  IF COALESCE(esta_ativo, true) = false THEN
    RAISE EXCEPTION 'Conta desativada. Fale com a diretoria.';
  END IF;

  IF NEW.nome_convidado IS NOT NULL THEN RETURN NEW; END IF;
  IF auth.uid() IS DISTINCT FROM NEW.usuario_id THEN RETURN NEW; END IF;

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
