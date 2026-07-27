REVOKE ALL ON FUNCTION public.aplica_suspensao_vermelho() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.valida_checkin() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notifica_solicitacao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notifica_pagamento() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notifica(uuid, text, text, text) FROM PUBLIC, anon, authenticated;