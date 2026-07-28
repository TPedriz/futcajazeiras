ALTER VIEW public.ranking_mensal SET (security_invoker = on);
GRANT SELECT ON public.ranking_mensal TO authenticated;