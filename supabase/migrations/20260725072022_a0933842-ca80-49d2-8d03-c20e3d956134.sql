
DROP POLICY IF EXISTS "Associados leem todos os perfis" ON public.perfis;

CREATE POLICY "Usuário lê o próprio perfil"
  ON public.perfis FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admin lê todos os perfis"
  ON public.perfis FOR SELECT TO authenticated
  USING (public.tem_papel(auth.uid(), 'administrador'));

CREATE OR REPLACE VIEW public.perfis_publicos
  WITH (security_invoker = true) AS
  SELECT id, nome, posicao FROM public.perfis;

GRANT SELECT ON public.perfis_publicos TO authenticated;

-- Also expose non-sensitive fields via a SECURITY DEFINER-free path:
-- add a permissive RLS policy scoped to safe usage is not possible column-wise,
-- so we rely on the view above plus a policy allowing authenticated to read
-- only id/nome/posicao through the view. The view runs as invoker, so we need
-- an underlying policy. Add a narrow policy limited to authenticated that
-- returns rows but is intended to be consumed only via the view.
CREATE POLICY "Autenticados leem perfis via visão pública"
  ON public.perfis FOR SELECT TO authenticated
  USING (true);

-- Revoke direct SELECT on the base table from authenticated to force use of
-- own-row / admin policies for full row, and the view for public fields.
-- (RLS still applies; this removes the ability to bypass column filtering.)
-- NOTE: Keeping table SELECT grant so own-row + admin policies keep working;
-- the "Autenticados leem perfis via visão pública" above would re-expose all
-- rows. Drop it and instead expose only the view.
DROP POLICY "Autenticados leem perfis via visão pública" ON public.perfis;

REVOKE EXECUTE ON FUNCTION public.cria_perfil_novo_usuario() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.atualiza_atualizado_em() FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.define_fechamento_lista() FROM PUBLIC, authenticated, anon;
