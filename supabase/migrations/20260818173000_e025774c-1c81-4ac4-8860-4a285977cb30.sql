-- 1. Telefone dos convidados: fora do alcance de usuários logados (usar telefone_convidado())
REVOKE SELECT ON public.convidados_cadastro FROM authenticated, anon;
GRANT SELECT (id, nome, criado_por, user_id, aprovado, bloqueado, criado_em, atualizado_em)
  ON public.convidados_cadastro TO authenticated;
GRANT ALL ON public.convidados_cadastro TO service_role;

-- 2. Presenças: valor e mp_status só via funções/servidor
REVOKE SELECT ON public.presencas FROM authenticated, anon;
GRANT SELECT (id, baba_id, usuario_id, nome_convidado, status_convidado, confirmado_em,
              convidado_user_id, chegou_em, ordem_chegada, compareceu,
              convidado_cadastro_id, is_goleiro_fixo)
  ON public.presencas TO authenticated;
GRANT ALL ON public.presencas TO service_role;

-- 3. Reajuste de mensalidades: somente diretoria / rotinas internas
REVOKE ALL ON FUNCTION public.reajusta_mensalidades_pendentes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reajusta_mensalidades_pendentes() TO service_role;

CREATE OR REPLACE FUNCTION public.reajusta_mensalidades_pendentes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_valor numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.tem_papel(auth.uid(), 'administrador') THEN
    RAISE EXCEPTION 'Apenas a diretoria pode reajustar mensalidades';
  END IF;

  v_valor := public.valor_mensalidade();

  UPDATE public.mensalidades
  SET valor = v_valor,
      mp_payment_id = NULL,
      mp_status = NULL,
      pix_qr_code = NULL,
      pix_qr_base64 = NULL,
      pix_expira_em = NULL,
      atualizado_em = now()
  WHERE status = 'pendente'
    AND valor IS DISTINCT FROM v_valor;
END;
$function$;

REVOKE ALL ON FUNCTION public.reajusta_mensalidades_pendentes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reajusta_mensalidades_pendentes() TO service_role;