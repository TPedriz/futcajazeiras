REVOKE SELECT ON public.convidados_cadastro FROM authenticated;
GRANT SELECT (id, nome, criado_por, user_id, aprovado, bloqueado, criado_em, atualizado_em)
  ON public.convidados_cadastro TO authenticated;
GRANT ALL ON public.convidados_cadastro TO service_role;

CREATE OR REPLACE FUNCTION public.telefone_convidado(_convidado_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.telefone
    FROM public.convidados_cadastro c
   WHERE c.id = _convidado_id
     AND (
       public.tem_papel(auth.uid(), 'administrador')
       OR c.criado_por = auth.uid()
       OR c.user_id = auth.uid()
     );
$$;

REVOKE ALL ON FUNCTION public.telefone_convidado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.telefone_convidado(uuid) TO authenticated;