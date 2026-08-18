-- 1) Telefone de convidados: some do acesso direto de usuários logados.
REVOKE SELECT ON public.convidados_cadastro FROM authenticated;
GRANT SELECT (id, nome, criado_por, user_id, aprovado, bloqueado, criado_em, atualizado_em)
  ON public.convidados_cadastro TO authenticated;

-- 2) Dados financeiros das presenças: fora do SELECT amplo.
REVOKE SELECT ON public.presencas FROM authenticated;
GRANT SELECT (id, baba_id, usuario_id, nome_convidado, status_convidado, confirmado_em,
              convidado_user_id, chegou_em, ordem_chegada, compareceu,
              convidado_cadastro_id, is_goleiro_fixo)
  ON public.presencas TO authenticated;

CREATE OR REPLACE FUNCTION public.status_pagamento_presencas(_baba_id uuid)
RETURNS TABLE(presenca_id uuid, mp_status text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.mp_status
  FROM public.presencas p
  WHERE p.baba_id = _baba_id
    AND (
      public.tem_papel(auth.uid(), 'administrador')
      OR p.usuario_id = auth.uid()
      OR p.convidado_user_id = auth.uid()
    );
$$;
REVOKE ALL ON FUNCTION public.status_pagamento_presencas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.status_pagamento_presencas(uuid) TO authenticated, service_role;

-- 3) Ajustes de babas de convidado: só o próprio usuário e a diretoria.
DROP POLICY IF EXISTS "Todos leem ajustes de babas" ON public.ajustes_babas_convidado;
CREATE POLICY "Usuario ou diretoria leem ajustes de babas"
  ON public.ajustes_babas_convidado FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.tem_papel(auth.uid(), 'administrador'));

-- 4) View ranking_cartinhas passa a ser security_invoker sobre perfis_publicos.
ALTER TABLE public.perfis_publicos
  ADD COLUMN IF NOT EXISTS ovr integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS stat_ritmo integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS stat_finalizacao integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS stat_passe integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS stat_drible integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS stat_defesa integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS stat_fisico integer NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS tema_carta text NOT NULL DEFAULT 'ouro';

CREATE OR REPLACE FUNCTION public.sincroniza_perfil_publico()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.perfis_publicos (
    id, nome, posicao, ativo, time_coracao, avatar_url,
    ovr, stat_ritmo, stat_finalizacao, stat_passe, stat_drible, stat_defesa, stat_fisico, tema_carta
  )
  VALUES (
    NEW.id, NEW.nome, NEW.posicao, NEW.ativo, NEW.time_coracao, NEW.avatar_url,
    NEW.ovr, NEW.stat_ritmo, NEW.stat_finalizacao, NEW.stat_passe, NEW.stat_drible,
    NEW.stat_defesa, NEW.stat_fisico, NEW.tema_carta
  )
  ON CONFLICT (id) DO UPDATE SET
    nome = EXCLUDED.nome,
    posicao = EXCLUDED.posicao,
    ativo = EXCLUDED.ativo,
    time_coracao = EXCLUDED.time_coracao,
    avatar_url = EXCLUDED.avatar_url,
    ovr = EXCLUDED.ovr,
    stat_ritmo = EXCLUDED.stat_ritmo,
    stat_finalizacao = EXCLUDED.stat_finalizacao,
    stat_passe = EXCLUDED.stat_passe,
    stat_drible = EXCLUDED.stat_drible,
    stat_defesa = EXCLUDED.stat_defesa,
    stat_fisico = EXCLUDED.stat_fisico,
    tema_carta = EXCLUDED.tema_carta;
  RETURN NEW;
END;
$$;

UPDATE public.perfis_publicos pp
SET ovr = p.ovr,
    stat_ritmo = p.stat_ritmo,
    stat_finalizacao = p.stat_finalizacao,
    stat_passe = p.stat_passe,
    stat_drible = p.stat_drible,
    stat_defesa = p.stat_defesa,
    stat_fisico = p.stat_fisico,
    tema_carta = p.tema_carta
FROM public.perfis p
WHERE p.id = pp.id;

DROP VIEW IF EXISTS public.ranking_cartinhas;
CREATE VIEW public.ranking_cartinhas
WITH (security_invoker = true) AS
SELECT id, nome, avatar_url, posicao, ovr, stat_ritmo, stat_finalizacao,
       stat_passe, stat_drible, stat_defesa, stat_fisico, tema_carta
FROM public.perfis_publicos
WHERE ativo = true;
GRANT SELECT ON public.ranking_cartinhas TO authenticated;

-- 5) Reajuste de mensalidades: só diretoria/serviço.
CREATE OR REPLACE FUNCTION public.reajusta_mensalidades_pendentes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_valor numeric;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.tem_papel(auth.uid(), 'administrador') THEN
    RAISE EXCEPTION 'Apenas a diretoria pode reajustar mensalidades';
  END IF;

  v_valor := public.valor_mensalidade();

  UPDATE public.mensalidades
  SET valor = v_valor,
      mp_payment_id = NULL,
      mp_status = NULL,
      pix_qr_code = NULL,
      pix_qr_base64 = NULL,
      pix_expira_em = NULL,
      atualizado_em = now()
  WHERE status = 'pendente'
    AND valor IS DISTINCT FROM v_valor;
END;
$$;
REVOKE ALL ON FUNCTION public.reajusta_mensalidades_pendentes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reajusta_mensalidades_pendentes() TO service_role;

-- 6) Funções de gatilho não devem ser chamáveis pela API.
REVOKE ALL ON FUNCTION public.aplica_suspensao_amarelos() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.aplica_suspensao_faltas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atualiza_cartinha_estatisticas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atualiza_cartinha_presenca() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.atualiza_cartinha_times() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ganho_xp_estatisticas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ganho_xp_presenca() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.limita_destaques_conquistas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reavalia_conquistas_estatisticas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reavalia_conquistas_times() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recalcula_cartinha_apos_suspensao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registra_evento_nivel() FROM PUBLIC, anon, authenticated;

-- 7) search_path fixo nas funções puras.
ALTER FUNCTION public.nivel_para_xp(integer) SET search_path = public;
ALTER FUNCTION public.xp_necessaria_para_nivel(integer) SET search_path = public;
REVOKE ALL ON FUNCTION public.nivel_para_xp(integer) FROM anon;
REVOKE ALL ON FUNCTION public.xp_necessaria_para_nivel(integer) FROM anon;