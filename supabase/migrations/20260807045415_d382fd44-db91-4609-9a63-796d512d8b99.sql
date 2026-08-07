CREATE OR REPLACE FUNCTION public.reajusta_mensalidades_pendentes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor numeric;
BEGIN
  SELECT valor INTO v_valor FROM public.configuracoes WHERE chave = 'valor_mensalidade';
  IF v_valor IS NULL OR v_valor <= 0 THEN
    RETURN;
  END IF;

  UPDATE public.mensalidades
  SET valor = v_valor,
      mp_payment_id = NULL,
      mp_status = NULL,
      pix_qr_code = NULL,
      pix_qr_base64 = NULL,
      pix_expira_em = NULL
  WHERE status = 'pendente'
    AND valor IS DISTINCT FROM v_valor;
END;
$$;
REVOKE ALL ON FUNCTION public.reajusta_mensalidades_pendentes() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reajusta_mensalidades_pendentes() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.on_valor_mensalidade_muda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chave = 'valor_mensalidade'
     AND (TG_OP = 'INSERT' OR NEW.valor IS DISTINCT FROM OLD.valor) THEN
    PERFORM public.reajusta_mensalidades_pendentes();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.on_valor_mensalidade_muda() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_reajuste_mensalidade ON public.configuracoes;
CREATE TRIGGER trg_reajuste_mensalidade
  AFTER INSERT OR UPDATE OF valor ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.on_valor_mensalidade_muda();

SELECT public.reajusta_mensalidades_pendentes();