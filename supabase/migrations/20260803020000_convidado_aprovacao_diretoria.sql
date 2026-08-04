-- ============================================================
-- Convidado "pede a um associado" também passa pela aprovação
-- da diretoria. O pedido criado a partir de uma solicitação fica
-- vinculado a ela (solicitacao_id) para o convidado acompanhar.
-- Nenhum PIX é gerado antes da aprovação da diretoria.
-- ============================================================

ALTER TABLE public.pedidos_convidado
  ADD COLUMN IF NOT EXISTS solicitacao_id uuid
    REFERENCES public.solicitacoes_convidado(id) ON DELETE SET NULL;
