-- ============================================================================
-- Recuperação de senha, validação de e-mail e senhas de emergência
-- ============================================================================

-- 1) perfis.email passa a guardar o E-MAIL REAL de contato (opcional).
--    O login continua sendo feito pelo e-mail sintético do Auth
--    (@wa.futcajazeiras.local, derivado do telefone). Contas antigas sem
--    e-mail real cadastrado ficam com email = NULL (critério "email IS NULL").
ALTER TABLE public.perfis ALTER COLUMN email DROP NOT NULL;

UPDATE public.perfis
   SET email = NULL
 WHERE email LIKE '%@wa.futcajazeiras.local';

-- 2) Confirmação de e-mail por perfil (usada pelo guard de bloqueio)
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS email_confirmado BOOLEAN NOT NULL DEFAULT false;

-- 3) Tokens de verificação/recuperação de e-mail.
--    Acesso exclusivo via service_role (nenhuma policy de RLS é criada para
--    usuários autenticados: o cliente nunca lê/grava essa tabela).
CREATE TABLE IF NOT EXISTS public.verificacoes_email (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  tipo TEXT NOT NULL DEFAULT 'email' CHECK (tipo IN ('email', 'recuperacao')),
  expira_em TIMESTAMPTZ NOT NULL,
  usado_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS verificacoes_email_usuario_idx ON public.verificacoes_email (usuario_id);
CREATE INDEX IF NOT EXISTS verificacoes_email_token_idx ON public.verificacoes_email (token_hash);

GRANT ALL ON public.verificacoes_email TO service_role;
ALTER TABLE public.verificacoes_email ENABLE ROW LEVEL SECURITY;

-- 4) Novo cadastro: NÃO copia o e-mail sintético para perfis.email.
--    O trigger passa a gravar NULL quando o Auth usa o placeholder @wa.futcajazeiras.local.
CREATE OR REPLACE FUNCTION public.cria_perfil_novo_usuario()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  tel text;
  email_real text;
BEGIN
  tel := COALESCE(NEW.raw_user_meta_data ->> 'telefone', '');
  email_real := NEW.email;
  IF email_real LIKE '%@wa.futcajazeiras.local' THEN
    email_real := NULL;
  END IF;
  INSERT INTO public.perfis (id, nome, email, telefone, posicao)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    email_real,
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
