-- 1) Nomes visíveis na lista do baba (view sem security_invoker, expõe só id/nome/posição)
DROP VIEW IF EXISTS public.perfis_publicos;
CREATE VIEW public.perfis_publicos AS
  SELECT id, nome, posicao FROM public.perfis;
GRANT SELECT ON public.perfis_publicos TO authenticated;

-- 2) Mensalidades
CREATE TABLE public.mensalidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  referencia date NOT NULL,
  vencimento date NOT NULL,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  status public.status_pagamento NOT NULL DEFAULT 'pendente',
  pago_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (usuario_id, referencia)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mensalidades TO authenticated;
GRANT ALL ON public.mensalidades TO service_role;
ALTER TABLE public.mensalidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário lê as próprias mensalidades" ON public.mensalidades
  FOR SELECT TO authenticated
  USING (auth.uid() = usuario_id OR public.tem_papel(auth.uid(), 'administrador'));
CREATE POLICY "Admin gerencia mensalidades" ON public.mensalidades
  FOR ALL TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

CREATE TRIGGER mensalidades_atualizado_em
  BEFORE UPDATE ON public.mensalidades
  FOR EACH ROW EXECUTE FUNCTION public.atualiza_atualizado_em();

-- vencimento sempre no último dia do mês de referência
CREATE OR REPLACE FUNCTION public.define_vencimento_mensalidade()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.referencia := date_trunc('month', NEW.referencia)::date;
  NEW.vencimento := (date_trunc('month', NEW.referencia) + INTERVAL '1 month - 1 day')::date;
  IF NEW.status = 'pago' AND NEW.pago_em IS NULL THEN
    NEW.pago_em := now();
  ELSIF NEW.status = 'pendente' THEN
    NEW.pago_em := NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.define_vencimento_mensalidade() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER mensalidades_vencimento
  BEFORE INSERT OR UPDATE ON public.mensalidades
  FOR EACH ROW EXECUTE FUNCTION public.define_vencimento_mensalidade();

-- espelha o status do mês corrente no perfil
CREATE OR REPLACE FUNCTION public.sincroniza_status_perfil()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.referencia = date_trunc('month', now())::date THEN
    UPDATE public.perfis SET status_pagamento = NEW.status WHERE id = NEW.usuario_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sincroniza_status_perfil() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER mensalidades_sincroniza_perfil
  AFTER INSERT OR UPDATE ON public.mensalidades
  FOR EACH ROW EXECUTE FUNCTION public.sincroniza_status_perfil();

-- gera as mensalidades do mês corrente para todos os associados
CREATE OR REPLACE FUNCTION public.garante_mensalidades_mes()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ref date := date_trunc('month', now())::date;
BEGIN
  INSERT INTO public.mensalidades (usuario_id, referencia, vencimento)
  SELECT p.id, ref, (date_trunc('month', ref) + INTERVAL '1 month - 1 day')::date
  FROM public.perfis p
  ON CONFLICT (usuario_id, referencia) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.garante_mensalidades_mes() TO authenticated;

-- histórico inicial: mês corrente para quem já existe
INSERT INTO public.mensalidades (usuario_id, referencia, vencimento, status)
SELECT p.id, date_trunc('month', now())::date,
       (date_trunc('month', now()) + INTERVAL '1 month - 1 day')::date,
       p.status_pagamento
FROM public.perfis p
ON CONFLICT DO NOTHING;

-- 3) Cargos gerenciáveis pela diretoria
CREATE POLICY "Admin concede cargos" ON public.papeis_usuario
  FOR INSERT TO authenticated
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));
CREATE POLICY "Admin remove cargos" ON public.papeis_usuario
  FOR DELETE TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'));
GRANT INSERT, DELETE ON public.papeis_usuario TO authenticated;

-- 4) Times sorteados e resultados
CREATE TYPE public.resultado_time AS ENUM ('vitoria', 'derrota', 'empate');

CREATE TABLE public.times_baba (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baba_id uuid NOT NULL REFERENCES public.sessoes_baba(id) ON DELETE CASCADE,
  nome text NOT NULL,
  resultado public.resultado_time,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.times_baba TO authenticated;
GRANT ALL ON public.times_baba TO service_role;
ALTER TABLE public.times_baba ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leem times" ON public.times_baba FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia times" ON public.times_baba FOR ALL TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));
CREATE TRIGGER times_baba_atualizado_em BEFORE UPDATE ON public.times_baba
  FOR EACH ROW EXECUTE FUNCTION public.atualiza_atualizado_em();

CREATE TABLE public.times_jogadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  time_id uuid NOT NULL REFERENCES public.times_baba(id) ON DELETE CASCADE,
  usuario_id uuid REFERENCES public.perfis(id) ON DELETE CASCADE,
  nome_convidado text,
  posicao public.posicao_jogador NOT NULL DEFAULT 'linha',
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.times_jogadores TO authenticated;
GRANT ALL ON public.times_jogadores TO service_role;
ALTER TABLE public.times_jogadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leem jogadores dos times" ON public.times_jogadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia jogadores dos times" ON public.times_jogadores FOR ALL TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

-- 5) Estatísticas
CREATE TABLE public.estatisticas_baba (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baba_id uuid NOT NULL REFERENCES public.sessoes_baba(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES public.perfis(id) ON DELETE CASCADE,
  gols integer NOT NULL DEFAULT 0,
  cartoes_amarelos integer NOT NULL DEFAULT 0,
  cartoes_azuis integer NOT NULL DEFAULT 0,
  cartoes_vermelhos integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (baba_id, usuario_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estatisticas_baba TO authenticated;
GRANT ALL ON public.estatisticas_baba TO service_role;
ALTER TABLE public.estatisticas_baba ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Todos leem estatísticas" ON public.estatisticas_baba FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia estatísticas" ON public.estatisticas_baba FOR ALL TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));
CREATE TRIGGER estatisticas_atualizado_em BEFORE UPDATE ON public.estatisticas_baba
  FOR EACH ROW EXECUTE FUNCTION public.atualiza_atualizado_em();

-- 6) Ranking mensal
CREATE VIEW public.ranking_mensal AS
WITH gols AS (
  SELECT date_trunc('month', s.data_horario)::date AS mes,
         e.usuario_id,
         SUM(e.gols)::int AS gols,
         SUM(e.cartoes_amarelos)::int AS cartoes_amarelos,
         SUM(e.cartoes_azuis)::int AS cartoes_azuis,
         SUM(e.cartoes_vermelhos)::int AS cartoes_vermelhos
  FROM public.estatisticas_baba e
  JOIN public.sessoes_baba s ON s.id = e.baba_id
  GROUP BY 1, 2
),
resultados AS (
  SELECT date_trunc('month', s.data_horario)::date AS mes,
         tj.usuario_id,
         COUNT(*) FILTER (WHERE t.resultado = 'vitoria')::int AS vitorias,
         COUNT(*) FILTER (WHERE t.resultado = 'derrota')::int AS derrotas,
         COUNT(*) FILTER (WHERE t.resultado = 'empate')::int AS empates
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
       COALESCE(g.cartoes_amarelos, 0) AS cartoes_amarelos,
       COALESCE(g.cartoes_azuis, 0) AS cartoes_azuis,
       COALESCE(g.cartoes_vermelhos, 0) AS cartoes_vermelhos,
       COALESCE(r.vitorias, 0) AS vitorias,
       COALESCE(r.derrotas, 0) AS derrotas,
       COALESCE(r.empates, 0) AS empates
FROM gols g
FULL OUTER JOIN resultados r ON r.mes = g.mes AND r.usuario_id = g.usuario_id
JOIN public.perfis p ON p.id = COALESCE(g.usuario_id, r.usuario_id);
GRANT SELECT ON public.ranking_mensal TO authenticated;