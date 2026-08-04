DROP FUNCTION IF EXISTS public.notifica(uuid, text, text, text);

REVOKE ALL ON FUNCTION public.notifica(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.notifica(uuid, text, text, text, text) TO service_role;