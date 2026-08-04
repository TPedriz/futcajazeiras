-- Diária de convidado configurável (default R$ 5,00)
INSERT INTO public.configuracoes (chave, valor) VALUES ('valor_convidado', 5)
  ON CONFLICT (chave) DO NOTHING;
