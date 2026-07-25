
-- ============ ENUMS ============
CREATE TYPE public.papel_usuario AS ENUM ('administrador', 'associado');
CREATE TYPE public.posicao_jogador AS ENUM ('goleiro', 'linha');
CREATE TYPE public.status_pagamento AS ENUM ('pago', 'pendente');
CREATE TYPE public.status_convidado AS ENUM ('pendente', 'aprovado', 'rejeitado');

-- ============ PROFILES ============
CREATE TABLE public.perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  posicao public.posicao_jogador NOT NULL DEFAULT 'linha',
  status_pagamento public.status_pagamento NOT NULL DEFAULT 'pendente',
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.perfis TO authenticated;
GRANT ALL ON public.perfis TO service_role;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;

-- ============ ROLES (separate table for security) ============
CREATE TABLE public.papeis_usuario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  papel public.papel_usuario NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, papel)
);

GRANT SELECT ON public.papeis_usuario TO authenticated;
GRANT ALL ON public.papeis_usuario TO service_role;
ALTER TABLE public.papeis_usuario ENABLE ROW LEVEL SECURITY;

-- security definer para checar papel sem recursão de RLS
CREATE OR REPLACE FUNCTION public.tem_papel(_user_id UUID, _papel public.papel_usuario)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.papeis_usuario
    WHERE user_id = _user_id AND papel = _papel
  )
$$;

-- ============ SESSÕES DE BABA ============
CREATE TABLE public.sessoes_baba (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_horario TIMESTAMPTZ NOT NULL,
  local TEXT NOT NULL,
  fechamento_lista TIMESTAMPTZ NOT NULL,
  esta_fechado BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessoes_baba TO authenticated;
GRANT ALL ON public.sessoes_baba TO service_role;
ALTER TABLE public.sessoes_baba ENABLE ROW LEVEL SECURITY;

-- ============ PRESENÇAS ============
CREATE TABLE public.presencas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baba_id UUID NOT NULL REFERENCES public.sessoes_baba(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome_convidado TEXT,
  status_convidado public.status_convidado,
  confirmado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Um associado só pode ter 1 presença própria (nome_convidado NULL) por baba
  -- e 1 convidado por baba (nome_convidado NOT NULL)
  CONSTRAINT presenca_convidado_consistente CHECK (
    (nome_convidado IS NULL AND status_convidado IS NULL) OR
    (nome_convidado IS NOT NULL AND status_convidado IS NOT NULL)
  )
);

CREATE UNIQUE INDEX presenca_propria_unica ON public.presencas (baba_id, usuario_id)
  WHERE nome_convidado IS NULL;
CREATE UNIQUE INDEX presenca_convidado_unico ON public.presencas (baba_id, usuario_id)
  WHERE nome_convidado IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presencas TO authenticated;
GRANT ALL ON public.presencas TO service_role;
ALTER TABLE public.presencas ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
-- perfis
CREATE POLICY "Associados leem todos os perfis" ON public.perfis
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuário edita o próprio perfil" ON public.perfis
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin edita qualquer perfil" ON public.perfis
  FOR UPDATE TO authenticated USING (public.tem_papel(auth.uid(), 'administrador'));
CREATE POLICY "Usuário insere o próprio perfil" ON public.perfis
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- papéis: usuário lê seus próprios papéis; admins leem todos; escrita só via service_role
CREATE POLICY "Usuário lê os próprios papéis" ON public.papeis_usuario
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.tem_papel(auth.uid(), 'administrador'));

-- sessoes_baba: todos autenticados leem; admins gerenciam
CREATE POLICY "Todos leem sessões" ON public.sessoes_baba
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gerencia sessões" ON public.sessoes_baba
  FOR ALL TO authenticated USING (public.tem_papel(auth.uid(), 'administrador')) WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

-- presencas: todos autenticados leem; usuário insere/remove sua própria presença e seu convidado; admin gerencia tudo
CREATE POLICY "Todos leem presenças" ON public.presencas
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Associado gerencia própria presença" ON public.presencas
  FOR ALL TO authenticated USING (auth.uid() = usuario_id) WITH CHECK (auth.uid() = usuario_id);
CREATE POLICY "Admin gerencia presenças" ON public.presencas
  FOR ALL TO authenticated USING (public.tem_papel(auth.uid(), 'administrador')) WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.atualiza_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.atualizado_em = now(); RETURN NEW; END;
$$;

CREATE TRIGGER perfis_atualizado_em BEFORE UPDATE ON public.perfis
  FOR EACH ROW EXECUTE FUNCTION public.atualiza_atualizado_em();
CREATE TRIGGER sessoes_atualizado_em BEFORE UPDATE ON public.sessoes_baba
  FOR EACH ROW EXECUTE FUNCTION public.atualiza_atualizado_em();

-- Trigger para calcular fechamento_lista = data_horario - 3 horas
CREATE OR REPLACE FUNCTION public.define_fechamento_lista()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.fechamento_lista = NEW.data_horario - INTERVAL '3 hours';
  RETURN NEW;
END;
$$;

CREATE TRIGGER sessoes_fechamento BEFORE INSERT OR UPDATE OF data_horario ON public.sessoes_baba
  FOR EACH ROW EXECUTE FUNCTION public.define_fechamento_lista();

-- Auto-cria perfil ao cadastrar usuário
CREATE OR REPLACE FUNCTION public.cria_perfil_novo_usuario()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, email, posicao)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data ->> 'posicao')::public.posicao_jogador, 'linha')
  );
  -- Todo novo usuário começa como associado
  INSERT INTO public.papeis_usuario (user_id, papel) VALUES (NEW.id, 'associado');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.cria_perfil_novo_usuario();
