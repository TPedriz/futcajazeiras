CREATE OR REPLACE FUNCTION public.cria_perfil_novo_usuario()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.perfis (id, nome, email, telefone, posicao)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'nome', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'telefone', ''),
    COALESCE((NEW.raw_user_meta_data ->> 'posicao')::public.posicao_jogador, 'linha')
  );
  INSERT INTO public.papeis_usuario (user_id, papel) VALUES (NEW.id, 'convidado');
  RETURN NEW;
END;
$function$;
