-- Taxas por forma de pagamento (PIX, cartão de débito e cartão de crédito).
--
-- A taxa é somada ao valor cobrado do pagador, sempre arredondada PARA CIMA
-- até o centavo. Assim o valor líquido liberado no mesmo dia na conta do
-- Mercado Pago é exatamente o valor base da cobrança.
--
-- Percentuais em % (ex.: 4.99 = 4,99%). Ajustáveis pela diretoria em
-- Admin › Financeiro ("Taxas por forma de pagamento").
INSERT INTO public.configuracoes (chave, valor) VALUES
  ('taxa_pix', 0),
  ('taxa_debito', 1.99),
  ('taxa_credito', 4.99)
ON CONFLICT (chave) DO NOTHING;
