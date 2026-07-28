REVOKE ALL ON FUNCTION public.limita_associados() FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.notifica_associacao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE admin_id uuid; nome_solic text;
BEGIN
  SELECT nome INTO nome_solic FROM public.perfis WHERE id = NEW.usuario_id;
  IF TG_OP = 'INSERT' THEN
    FOR admin_id IN SELECT user_id FROM public.papeis_usuario WHERE papel = 'administrador' LOOP
      PERFORM public.notifica(admin_id, 'associacao', 'Novo pedido de associação',
        COALESCE(nome_solic, 'Um convidado') || ' quer virar associado do baba.');
    END LOOP;
  ELSIF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'aprovado' THEN
      PERFORM public.notifica(NEW.usuario_id, 'associacao', 'Bem-vindo, Associado!',
        'Sua associação foi aprovada pela diretoria.');
    ELSIF NEW.status = 'rejeitado' THEN
      PERFORM public.notifica(NEW.usuario_id, 'associacao', 'Pedido de associação recusado',
        'A diretoria não aprovou seu pedido desta vez.');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notifica_associacao() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notifica_associacao ON public.solicitacoes_associacao;
CREATE TRIGGER trg_notifica_associacao
AFTER INSERT OR UPDATE ON public.solicitacoes_associacao
FOR EACH ROW EXECUTE FUNCTION public.notifica_associacao();