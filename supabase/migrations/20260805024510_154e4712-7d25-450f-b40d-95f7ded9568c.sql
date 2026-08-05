CREATE TABLE IF NOT EXISTS public.ajustes_babas_convidado (
  usuario_id uuid PRIMARY KEY REFERENCES public.perfis(id) ON DELETE CASCADE,
  babas_credito integer NOT NULL DEFAULT 0 CHECK (babas_credito >= 0),
  observacao text NOT NULL DEFAULT '',
  atualizado_por uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ajustes_babas_convidado TO authenticated;
GRANT ALL ON public.ajustes_babas_convidado TO service_role;
ALTER TABLE public.ajustes_babas_convidado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Todos leem ajustes de babas" ON public.ajustes_babas_convidado;
CREATE POLICY "Todos leem ajustes de babas" ON public.ajustes_babas_convidado
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Diretoria gerencia ajustes de babas" ON public.ajustes_babas_convidado;
CREATE POLICY "Diretoria gerencia ajustes de babas" ON public.ajustes_babas_convidado
  FOR ALL TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'))
  WITH CHECK (public.tem_papel(auth.uid(), 'administrador'));

DROP TRIGGER IF EXISTS ajustes_babas_convidado_atualizado_em ON public.ajustes_babas_convidado;
CREATE TRIGGER ajustes_babas_convidado_atualizado_em
  BEFORE UPDATE ON public.ajustes_babas_convidado
  FOR EACH ROW EXECUTE FUNCTION public.atualiza_atualizado_em();

CREATE OR REPLACE FUNCTION public.babas_pagos_convidado(_user_id uuid)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COUNT(DISTINCT p.id)::integer +
         COALESCE(
           (SELECT a.babas_credito FROM public.ajustes_babas_convidado a WHERE a.usuario_id = _user_id),
           0
         )
    FROM public.presencas p
    LEFT JOIN public.convidados_cadastro c ON c.id = p.convidado_cadastro_id
   WHERE p.nome_convidado IS NOT NULL
     AND p.status_convidado = 'aprovado'
     AND (p.convidado_user_id = _user_id OR c.user_id = _user_id);
$$;

REVOKE ALL ON FUNCTION public.babas_pagos_convidado(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.babas_pagos_convidado(uuid) TO authenticated;