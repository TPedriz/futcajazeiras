ALTER TYPE public.papel_usuario ADD VALUE IF NOT EXISTS 'convidado';

CREATE TABLE public.solicitacoes_convidado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  baba_id uuid NOT NULL REFERENCES public.sessoes_baba(id) ON DELETE CASCADE,
  solicitante_id uuid NOT NULL,
  anfitriao_id uuid NOT NULL,
  status public.status_convidado NOT NULL DEFAULT 'pendente',
  presenca_id uuid REFERENCES public.presencas(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (baba_id, solicitante_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.solicitacoes_convidado TO authenticated;
GRANT ALL ON public.solicitacoes_convidado TO service_role;

ALTER TABLE public.solicitacoes_convidado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Envolvidos leem solicitacoes"
ON public.solicitacoes_convidado FOR SELECT TO authenticated
USING (auth.uid() = solicitante_id OR auth.uid() = anfitriao_id OR public.tem_papel(auth.uid(), 'administrador'));

CREATE POLICY "Solicitante cria solicitacao"
ON public.solicitacoes_convidado FOR INSERT TO authenticated
WITH CHECK (auth.uid() = solicitante_id);

CREATE POLICY "Anfitriao responde solicitacao"
ON public.solicitacoes_convidado FOR UPDATE TO authenticated
USING (auth.uid() = anfitriao_id OR public.tem_papel(auth.uid(), 'administrador'))
WITH CHECK (auth.uid() = anfitriao_id OR public.tem_papel(auth.uid(), 'administrador'));

CREATE POLICY "Solicitante ou admin remove solicitacao"
ON public.solicitacoes_convidado FOR DELETE TO authenticated
USING (auth.uid() = solicitante_id OR public.tem_papel(auth.uid(), 'administrador'));

CREATE TRIGGER solicitacoes_convidado_atualizado_em
BEFORE UPDATE ON public.solicitacoes_convidado
FOR EACH ROW EXECUTE FUNCTION public.atualiza_atualizado_em();
