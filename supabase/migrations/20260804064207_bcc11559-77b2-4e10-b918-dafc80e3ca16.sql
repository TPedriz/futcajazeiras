-- Trigger/internal functions: no direct execution by API roles
REVOKE ALL ON FUNCTION public.audita_perfil() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audita_presenca() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bloqueia_cancelamento_lista() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vincula_convidado_por_telefone() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notifica_admins(text, text, text, text) FROM PUBLIC, anon, authenticated;

-- App RPCs: authenticated only, never anonymous
REVOKE ALL ON FUNCTION public.criar_pedido_convidado(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.criar_pedido_convidado(uuid, text, text, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.decidir_pedido_convidado(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decidir_pedido_convidado(uuid, boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.solicita_convite(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicita_convite(uuid, uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.valor_mensalidade() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valor_mensalidade() TO authenticated;

-- Keep service_role able to run everything
GRANT EXECUTE ON FUNCTION public.audita_perfil() TO service_role;
GRANT EXECUTE ON FUNCTION public.audita_presenca() TO service_role;
GRANT EXECUTE ON FUNCTION public.bloqueia_cancelamento_lista() TO service_role;
GRANT EXECUTE ON FUNCTION public.vincula_convidado_por_telefone() TO service_role;
GRANT EXECUTE ON FUNCTION public.notifica_admins(text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.criar_pedido_convidado(uuid, text, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.decidir_pedido_convidado(uuid, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.solicita_convite(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.valor_mensalidade() TO service_role;