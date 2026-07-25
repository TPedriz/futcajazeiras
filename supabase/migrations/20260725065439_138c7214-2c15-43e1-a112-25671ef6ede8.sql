
REVOKE ALL ON FUNCTION public.atualiza_atualizado_em() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.define_fechamento_lista() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cria_perfil_novo_usuario() FROM PUBLIC, anon, authenticated;
-- tem_papel deve ser executável por authenticated (usada em RLS policies)
REVOKE ALL ON FUNCTION public.tem_papel(UUID, public.papel_usuario) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tem_papel(UUID, public.papel_usuario) TO authenticated;
