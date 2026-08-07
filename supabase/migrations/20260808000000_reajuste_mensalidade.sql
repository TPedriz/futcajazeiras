-- =====================================================================
-- Correção crítica: reajuste automático do valor de mensalidades pendentes.
--
-- O valor da mensalidade era "congelado" em `mensalidades.valor` no momento
-- da geração. Quando a diretoria muda `configuracoes.valor_mensalidade`,
-- as mensalidades já geradas e ainda pendentes continuavam com o valor
-- antigo (ex.: 20), gerando divergência entre a gestão (15) e o que o
-- usuário via/pagava (20).
--
-- Esta migração:
--  1. Cria `reajusta_mensalidades_pendentes()` — atualiza o valor das
--     pendentes para o valor atual de `configuracoes` e invalida PIX antigos.
--  2. Cria trigger em `configuracoes` que reajusta automaticamente quando
--     `valor_mensalidade` muda.
--  3. Aplica o backfill imediato nas pendentes existentes.
-- =====================================================================

-- ============ 1) Função de reajuste ============
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

  -- Atualiza o valor das mensalidades ainda não pagas e invalida PIX
  -- já emitidos com o valor antigo (força novo QR com o valor correto).
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

-- ============ 2) Trigger: reajusta ao alterar o valor ============
CREATE OR REPLACE FUNCTION public.on_valor_mensalidade_muda()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chave = 'valor_mensalidade' AND NEW.valor IS DISTINCT FROM OLD.valor THEN
    PERFORM public.reajusta_mensalidades_pendentes();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_reajuste_mensalidade ON public.configuracoes;
CREATE TRIGGER trg_reajuste_mensalidade
  AFTER INSERT OR UPDATE OF valor ON public.configuracoes
  FOR EACH ROW EXECUTE FUNCTION public.on_valor_mensalidade_muda();

-- ============ 3) Backfill imediato ============
SELECT public.reajusta_mensalidades_pendentes();
