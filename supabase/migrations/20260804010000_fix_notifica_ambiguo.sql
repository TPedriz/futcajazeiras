-- Remove o overload antigo de 4 argumentos de public.notifica.
-- Causa do erro "function public.notifica(uuid, unknown, unknown, text) is not unique":
-- existiam duas versões (4 args e 5 args com _link DEFAULT NULL) e o Postgres não
-- conseguia resolver chamadas com 4 argumentos. A versão de 5 args cobre as duas.
DROP FUNCTION IF EXISTS public.notifica(uuid, text, text, text);

-- Garante que a versão atual (com link) está acessível apenas internamente.
REVOKE ALL ON FUNCTION public.notifica(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notifica(uuid, text, text, text, text) TO service_role;
