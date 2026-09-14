-- ============================================================================
-- LOG DE AUDITORIA (uso interno da diretoria)
--
-- Registra "quem fez o quê, quando, em quem e o que mudou (de → para)" para as
-- ações relevantes do sistema: cadastro/perfil, cargos, financeiro, pagamentos
-- (com a forma de pagamento), lista do baba, convidados, punições, metas,
-- agenda, sessões e parâmetros do sistema.
--
-- Como funciona: um único trigger genérico (`public.log_auditoria_generico`)
-- recebe um JSON de configuração por argumento, calcula o diff dos campos
-- observados e grava em `public.logs_auditoria`. O ator é resolvido por
-- `auth.uid()` — quando não há sessão (rotina, webhook, service_role) o log
-- fica como "Sistema" (ou "Mercado Pago" quando a alteração é de forma de
-- pagamento).
--
-- Segurança: só a diretoria lê. Não existe policy de INSERT/UPDATE/DELETE —
-- as gravações acontecem apenas por funções SECURITY DEFINER (triggers) e pelo
-- service_role (server functions).
--
-- NUNCA quebra a operação original: qualquer erro na auditoria é engolido.
--
-- SCRIPT IDEMPOTENTE — pode ser executado novamente sem perda de histórico.
-- ============================================================================

-- ============ 1) Forma de pagamento nas tabelas de cobrança ============
-- Guarda a forma escolhida (pix | debito | credito). Na confirmação, o
-- Mercado Pago informa o tipo real e o valor é sobrescrito pelo servidor.
ALTER TABLE public.mensalidades ADD COLUMN IF NOT EXISTS metodo_pagamento text;
ALTER TABLE public.presencas ADD COLUMN IF NOT EXISTS metodo_pagamento text;
ALTER TABLE public.contribuicoes_meta ADD COLUMN IF NOT EXISTS metodo_pagamento text;
ALTER TABLE public.regularizacoes ADD COLUMN IF NOT EXISTS metodo_pagamento text;

-- Histórico: antes desta versão só existia PIX.
UPDATE public.mensalidades SET metodo_pagamento = 'pix'
 WHERE metodo_pagamento IS NULL AND status = 'pago';
UPDATE public.presencas SET metodo_pagamento = 'pix'
 WHERE metodo_pagamento IS NULL AND status_convidado = 'aprovado';
UPDATE public.contribuicoes_meta SET metodo_pagamento = 'pix'
 WHERE metodo_pagamento IS NULL AND status = 'confirmada';
UPDATE public.regularizacoes SET metodo_pagamento = 'pix'
 WHERE metodo_pagamento IS NULL AND status = 'pago';

-- ============ 2) Tabela de logs ============
CREATE TABLE IF NOT EXISTS public.logs_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criado_em timestamptz NOT NULL DEFAULT now(),
  ator_id uuid,
  ator_nome text NOT NULL DEFAULT 'Sistema',
  origem text NOT NULL DEFAULT 'sistema',
  categoria text NOT NULL DEFAULT 'sistema',
  acao text NOT NULL,
  entidade text,
  entidade_id text,
  alvo_id uuid,
  alvo_nome text,
  descricao text NOT NULL DEFAULT '',
  mudancas jsonb NOT NULL DEFAULT '[]'::jsonb,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  metodo_pagamento text
);

CREATE INDEX IF NOT EXISTS idx_logs_auditoria_criado    ON public.logs_auditoria (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_categoria ON public.logs_auditoria (categoria, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_ator      ON public.logs_auditoria (ator_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_alvo      ON public.logs_auditoria (alvo_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_entidade  ON public.logs_auditoria (entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_logs_auditoria_metodo    ON public.logs_auditoria (metodo_pagamento);

ALTER TABLE public.logs_auditoria ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Diretoria le logs de auditoria" ON public.logs_auditoria;
CREATE POLICY "Diretoria le logs de auditoria" ON public.logs_auditoria
  FOR SELECT TO authenticated USING (public.eh_diretoria(auth.uid()));

REVOKE ALL ON public.logs_auditoria FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.logs_auditoria TO authenticated;
GRANT ALL ON public.logs_auditoria TO service_role;

-- ============ 3) Rótulos e formatação ============

-- Nome legível de cada campo observado (fallback: Título Da Coluna).
CREATE OR REPLACE FUNCTION public.rotulo_campo_log(_campo text)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE _campo
    WHEN 'nome' THEN 'Nome'
    WHEN 'telefone' THEN 'WhatsApp'
    WHEN 'email' THEN 'E-mail'
    WHEN 'email_confirmado' THEN 'E-mail confirmado'
    WHEN 'posicao' THEN 'Posição'
    WHEN 'time_coracao' THEN 'Time do coração'
    WHEN 'instagram' THEN 'Instagram'
    WHEN 'ativo' THEN 'Conta ativa'
    WHEN 'status_conta' THEN 'Situação da conta'
    WHEN 'status_pagamento' THEN 'Status do mês'
    WHEN 'avatar_url' THEN 'Foto de perfil'
    WHEN 'imagem_url' THEN 'Imagem'
    WHEN 'ovr' THEN 'OVR'
    WHEN 'stat_ritmo' THEN 'Ritmo'
    WHEN 'stat_finalizacao' THEN 'Finalização'
    WHEN 'stat_passe' THEN 'Passe'
    WHEN 'stat_drible' THEN 'Drible'
    WHEN 'stat_defesa' THEN 'Defesa'
    WHEN 'stat_fisico' THEN 'Físico'
    WHEN 'tema_carta' THEN 'Tema da cartinha'
    WHEN 'financeiro_automatico' THEN 'Financeiro automático'
    WHEN 'papel' THEN 'Cargo'
    WHEN 'chave' THEN 'Parâmetro'
    WHEN 'valor' THEN 'Valor'
    WHEN 'valor_mensalidade' THEN 'Valor da mensalidade'
    WHEN 'valor_convidado' THEN 'Valor da diária de convidado'
    WHEN 'valor_multa_atraso' THEN 'Multa por atraso'
    WHEN 'valor_taxa_associacao' THEN 'Taxa de Associação'
    WHEN 'taxa_pix' THEN 'Taxa do PIX'
    WHEN 'taxa_debito' THEN 'Taxa do cartão de débito'
    WHEN 'taxa_credito' THEN 'Taxa do cartão de crédito'
    WHEN 'multa_valor' THEN 'Multa'
    WHEN 'metodo_pagamento' THEN 'Forma de pagamento'
    WHEN 'mp_status' THEN 'Status no Mercado Pago'
    WHEN 'pago_em' THEN 'Pago em'
    WHEN 'status' THEN 'Status'
    WHEN 'motivo' THEN 'Motivo'
    WHEN 'origem' THEN 'Origem'
    WHEN 'usuario_id' THEN 'Jogador'
    WHEN 'babas_credito' THEN 'Babas creditados'
    WHEN 'observacao' THEN 'Observação'
    WHEN 'aprovado' THEN 'Aprovado'
    WHEN 'bloqueado' THEN 'Bloqueado'
    WHEN 'titulo' THEN 'Título'
    WHEN 'descricao' THEN 'Descrição'
    WHEN 'valor_alvo' THEN 'Valor alvo'
    WHEN 'valor_item' THEN 'Valor do item'
    WHEN 'valor_arrecadado' THEN 'Arrecadado'
    WHEN 'tipo_arrecadacao' THEN 'Tipo de arrecadação'
    WHEN 'tamanho_padrao' THEN 'Tamanho padrão'
    WHEN 'exige_personalizacao' THEN 'Exige personalização'
    WHEN 'prazo' THEN 'Prazo'
    WHEN 'prazo_cadastro' THEN 'Prazo de cadastro'
    WHEN 'prazo_pagamento' THEN 'Prazo de pagamento'
    WHEN 'categoria' THEN 'Categoria'
    WHEN 'data_evento' THEN 'Data'
    WHEN 'data_horario' THEN 'Data e horário'
    WHEN 'hora_inicio' THEN 'Início'
    WHEN 'hora_fim' THEN 'Fim'
    WHEN 'local' THEN 'Local'
    WHEN 'organizador' THEN 'Organizador'
    WHEN 'vagas' THEN 'Vagas'
    WHEN 'fechamento_lista' THEN 'Fechamento da lista'
    WHEN 'abertura_lista' THEN 'Abertura da lista'
    WHEN 'esta_fechado' THEN 'Lista fechada'
    WHEN 'valor_total' THEN 'Total'
    WHEN 'valor_debitos' THEN 'Débitos'
    WHEN 'taxa_associacao' THEN 'Taxa de Associação'
    WHEN 'referencia' THEN 'Referência'
    WHEN 'vencimento' THEN 'Vencimento'
    WHEN 'nome_convidado' THEN 'Convidado'
    WHEN 'nome_camisa' THEN 'Nome na camisa'
    WHEN 'tamanho' THEN 'Tamanho'
    WHEN 'numero_camisa' THEN 'Número'
    WHEN 'anonima' THEN 'Anônima'
    WHEN 'is_goleiro_fixo' THEN 'Goleiro fixo'
    WHEN 'compareceu' THEN 'Compareceu'
    WHEN 'ordem_chegada' THEN 'Ordem de chegada'
    WHEN 'chegou_em' THEN 'Chegou em'
    WHEN 'status_convidado' THEN 'Status do convidado'
    ELSE initcap(replace(_campo, '_', ' '))
  END;
$$;

-- Valor legível: "—" para vazio, sim/não, R$ para valores, % para taxas,
-- datas em pt-BR e "atualizada" para URLs (evita despejar caminhos no log).
CREATE OR REPLACE FUNCTION public.formata_valor_log(_campo text, _valor jsonb, _contexto jsonb DEFAULT '{}'::jsonb)
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN _valor IS NULL OR jsonb_typeof(_valor) = 'null' THEN '—'
    WHEN jsonb_typeof(_valor) = 'boolean'
      THEN CASE WHEN _valor = 'true'::jsonb THEN 'sim' ELSE 'não' END
    WHEN jsonb_typeof(_valor) = 'string' AND (_valor #>> '{}') = '' THEN '(vazio)'
    WHEN _campo IN ('avatar_url', 'imagem_url')
      THEN CASE WHEN _valor IS NULL OR jsonb_typeof(_valor) = 'null' THEN '—' ELSE 'atualizada' END
    WHEN _campo = 'valor' AND COALESCE(_contexto->>'chave', '') LIKE 'taxa\_%'
      THEN (_valor #>> '{}')::numeric::text || '%'
    WHEN _campo = ANY (ARRAY['valor','multa_valor','valor_alvo','valor_item','valor_arrecadado',
                             'valor_total','valor_debitos','taxa_associacao'])
      THEN 'R$ ' || replace(to_char((_valor #>> '{}')::numeric, 'FM999999990.00'), '.', ',')
    WHEN _campo = ANY (ARRAY['referencia','vencimento','prazo','prazo_cadastro','prazo_pagamento','data_evento'])
      THEN to_char((_valor #>> '{}')::date, 'DD/MM/YYYY')
    WHEN _campo = ANY (ARRAY['pago_em','chegou_em','confirmada_em','criado_em','atualizado_em',
                             'multa_aplicada_em','usado_em','data_horario','fechamento_lista','abertura_lista'])
      THEN to_char((_valor #>> '{}')::timestamptz AT TIME ZONE 'America/Bahia', 'DD/MM/YYYY HH24:MI')
    ELSE _valor #>> '{}'
  END;
$$;

-- ============ 4) Gravação manual (server functions / rotinas) ============

CREATE OR REPLACE FUNCTION public.registra_log(
  _acao text,
  _categoria text,
  _descricao text,
  _entidade text DEFAULT NULL,
  _entidade_id text DEFAULT NULL,
  _alvo_id uuid DEFAULT NULL,
  _alvo_nome text DEFAULT NULL,
  _mudancas jsonb DEFAULT '[]'::jsonb,
  _detalhes jsonb DEFAULT '{}'::jsonb,
  _metodo_pagamento text DEFAULT NULL,
  _ator_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ator uuid := COALESCE(_ator_id, auth.uid());
  v_nome text;
  v_origem text;
  v_id uuid;
BEGIN
  SELECT nome INTO v_nome FROM public.perfis WHERE id = v_ator;
  IF v_ator IS NULL THEN
    v_nome := 'Sistema';
    v_origem := 'sistema';
  ELSIF public.eh_diretoria(v_ator) THEN
    v_nome := COALESCE(v_nome, 'Diretoria');
    v_origem := 'painel';
  ELSE
    v_nome := COALESCE(v_nome, 'Usuário');
    v_origem := 'app';
  END IF;

  INSERT INTO public.logs_auditoria (
    ator_id, ator_nome, origem, categoria, acao, entidade, entidade_id,
    alvo_id, alvo_nome, descricao, mudancas, detalhes, metodo_pagamento
  ) VALUES (
    v_ator, v_nome, v_origem, COALESCE(_categoria, 'sistema'), _acao, _entidade, _entidade_id,
    _alvo_id, COALESCE(_alvo_nome, (SELECT nome FROM public.perfis WHERE id = _alvo_id)),
    COALESCE(_descricao, ''), COALESCE(_mudancas, '[]'::jsonb), COALESCE(_detalhes, '{}'::jsonb),
    _metodo_pagamento
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registra_log(text, text, text, text, text, uuid, text, jsonb, jsonb, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registra_log(text, text, text, text, text, uuid, text, jsonb, jsonb, text, uuid) TO service_role;

-- ============ 5) Trigger genérico ============
--
-- Configuração (JSON no primeiro argumento do trigger):
--   acao              código da ação (ex.: "perfil_atualizado")
--   categoria         perfil | cargos | financeiro | pagamento | lista |
--                     convidados | punicoes | metas | agenda | sessoes | associacao
--   descricao         frase base ("Atualizou o cadastro")
--   id                coluna de identidade da linha (padrão: id)
--   nome              coluna com o "nome" do alvo (padrão: nome)
--   alvo              coluna com o uuid do jogador (padrão: usuario_id/user_id/id de perfis)
--   campos            lista (CSV) de campos observados; ausente = todos
--   ignorar           lista JSON de campos que nunca entram no diff
--   contexto          lista (CSV) de campos sempre exibidos no fim da descrição
--   somente_diretoria true = só registra quando quem age é da diretoria
--   notificar_campos  lista JSON de campos que disparam notificação à diretoria
--   titulo_notificacao título da notificação (padrão: "Ação da diretoria")
--   link              link da notificação
--   ator_padrao       nome do ator quando não há sessão (padrão: "Sistema")

CREATE OR REPLACE FUNCTION public.log_auditoria_generico()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cfg jsonb;
  v_acao text;
  v_categoria text;
  v_descricao_base text;
  v_id_campo text;
  v_nome_campo text;
  v_alvo_campo text;
  v_somente_diretoria boolean;
  v_link text;
  v_titulo_notif text;
  v_ator_padrao text;
  v_campos text[];
  v_ignorar text[] := ARRAY[]::text[];
  v_notificar text[] := ARRAY[]::text[];
  v_old jsonb;
  v_new jsonb;
  v_rec jsonb;
  v_mudancas jsonb := '[]'::jsonb;
  v_lista text[] := ARRAY[]::text[];
  v_campo text;
  v_de text;
  v_para text;
  v_ator uuid;
  v_ator_nome text;
  v_origem text;
  v_alvo_id uuid;
  v_alvo_nome text;
  v_contexto jsonb := '{}'::jsonb;
  v_contexto_txt text := '';
  v_metodo text;
  v_descricao text;
BEGIN
  v_cfg := TG_ARGV[0]::jsonb;
  v_acao := COALESCE(v_cfg->>'acao', 'alteracao');
  v_categoria := COALESCE(v_cfg->>'categoria', 'sistema');
  v_descricao_base := COALESCE(v_cfg->>'descricao', 'Alterou o registro');
  v_id_campo := COALESCE(NULLIF(v_cfg->>'id', ''), 'id');
  v_nome_campo := COALESCE(NULLIF(v_cfg->>'nome', ''), 'nome');
  v_alvo_campo := NULLIF(v_cfg->>'alvo', '');
  v_somente_diretoria := COALESCE((v_cfg->>'somente_diretoria')::boolean, false);
  v_link := NULLIF(v_cfg->>'link', '');
  v_titulo_notif := COALESCE(NULLIF(v_cfg->>'titulo_notificacao', ''), 'Ação da diretoria');
  v_ator_padrao := COALESCE(NULLIF(v_cfg->>'ator_padrao', ''), 'Sistema');

  IF COALESCE(v_cfg->>'campos', '') <> '' THEN
    v_campos := string_to_array(v_cfg->>'campos', ',');
  END IF;
  IF v_cfg ? 'ignorar' THEN
    SELECT COALESCE(array_agg(valor), ARRAY[]::text[]) INTO v_ignorar
      FROM jsonb_array_elements_text(v_cfg->'ignorar') AS valor;
  END IF;
  IF v_cfg ? 'notificar_campos' THEN
    SELECT COALESCE(array_agg(valor), ARRAY[]::text[]) INTO v_notificar
      FROM jsonb_array_elements_text(v_cfg->'notificar_campos') AS valor;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_rec := v_old;
  ELSIF TG_OP = 'INSERT' THEN
    v_new := to_jsonb(NEW);
    v_rec := v_new;
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_rec := v_new;
  END IF;

  v_ator := auth.uid();
  IF v_somente_diretoria AND (v_ator IS NULL OR NOT public.eh_diretoria(v_ator)) THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  -- ---------------------------------------------------------------- diff
  IF TG_OP = 'UPDATE' THEN
    FOR v_campo IN
      SELECT c FROM (
        SELECT unnest(COALESCE(v_campos, ARRAY(SELECT jsonb_object_keys(v_new)))) AS c
      ) AS campos
      WHERE NOT (c = ANY (v_ignorar))
        AND (v_new ? c OR v_old ? c)
        AND (v_new->c IS DISTINCT FROM v_old->c)
    LOOP
      v_de := public.formata_valor_log(v_campo, v_old->v_campo, v_rec);
      v_para := public.formata_valor_log(v_campo, v_new->v_campo, v_rec);
      IF v_de = v_para THEN CONTINUE; END IF;

      v_mudancas := v_mudancas || jsonb_build_array(jsonb_build_object(
        'campo', v_campo,
        'rotulo', public.rotulo_campo_log(v_campo),
        'de', v_de,
        'para', v_para
      ));

      IF v_campo IN ('avatar_url', 'imagem_url') THEN
        v_lista := v_lista || (public.rotulo_campo_log(v_campo) || ' atualizada');
      ELSE
        v_lista := v_lista || (public.rotulo_campo_log(v_campo) || ': ' || v_de || ' → ' || v_para);
      END IF;
    END LOOP;

    -- Nada relevante mudou: não gera log.
    IF jsonb_array_length(v_mudancas) = 0 THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;

  ELSIF TG_OP = 'INSERT' THEN
    FOR v_campo IN
      SELECT c FROM (
        SELECT unnest(COALESCE(v_campos, ARRAY(SELECT jsonb_object_keys(v_new)))) AS c
      ) AS campos
      WHERE NOT (c = ANY (v_ignorar))
        AND v_new ? c
    LOOP
      v_para := public.formata_valor_log(v_campo, v_new->v_campo, v_rec);
      IF v_para = '—' OR v_para = '(vazio)' THEN CONTINUE; END IF;

      v_mudancas := v_mudancas || jsonb_build_array(jsonb_build_object(
        'campo', v_campo,
        'rotulo', public.rotulo_campo_log(v_campo),
        'de', NULL,
        'para', v_para
      ));
      v_lista := v_lista || (public.rotulo_campo_log(v_campo) || ': ' || v_para);
    END LOOP;

  ELSE
    FOR v_campo IN
      SELECT c FROM (
        SELECT unnest(COALESCE(v_campos, ARRAY(SELECT jsonb_object_keys(v_old)))) AS c
      ) AS campos
      WHERE NOT (c = ANY (v_ignorar))
        AND v_old ? c
    LOOP
      v_de := public.formata_valor_log(v_campo, v_old->v_campo, v_rec);
      IF v_de = '—' OR v_de = '(vazio)' THEN CONTINUE; END IF;

      v_mudancas := v_mudancas || jsonb_build_array(jsonb_build_object(
        'campo', v_campo,
        'rotulo', public.rotulo_campo_log(v_campo),
        'de', v_de,
        'para', NULL
      ));
      v_lista := v_lista || (public.rotulo_campo_log(v_campo) || ': ' || v_de);
    END LOOP;
  END IF;

  -- ------------------------------------------------------- forma de pagamento
  -- Só considera "forma de pagamento" quando ela realmente mudou nesta ação.
  SELECT NULLIF(item->>'para', '—') INTO v_metodo
    FROM jsonb_array_elements(v_mudancas) AS item
   WHERE item->>'campo' = 'metodo_pagamento'
   LIMIT 1;

  -- --------------------------------------------------------------- ator
  IF v_ator IS NULL THEN
    -- Sem sessão: rotina/webhook. Mudança de forma de pagamento vem do MP.
    v_ator_nome := CASE WHEN v_metodo IS NOT NULL THEN 'Mercado Pago' ELSE v_ator_padrao END;
    v_origem := 'sistema';
  ELSE
    SELECT nome INTO v_ator_nome FROM public.perfis WHERE id = v_ator;
    v_ator_nome := COALESCE(v_ator_nome, 'Usuário');
    v_origem := CASE WHEN public.eh_diretoria(v_ator) THEN 'painel' ELSE 'app' END;
  END IF;

  -- --------------------------------------------------------------- alvo
  IF v_alvo_campo IS NOT NULL THEN
    v_alvo_id := NULLIF(v_rec->>v_alvo_campo, '')::uuid;
  ELSIF NULLIF(v_rec->>'usuario_id', '') IS NOT NULL THEN
    v_alvo_id := (v_rec->>'usuario_id')::uuid;
  ELSIF NULLIF(v_rec->>'user_id', '') IS NOT NULL THEN
    v_alvo_id := (v_rec->>'user_id')::uuid;
  ELSIF TG_TABLE_NAME = 'perfis' THEN
    v_alvo_id := NULLIF(v_rec->>'id', '')::uuid;
  END IF;

  IF v_alvo_id IS NOT NULL THEN
    SELECT nome INTO v_alvo_nome FROM public.perfis WHERE id = v_alvo_id;
  END IF;
  v_alvo_nome := COALESCE(v_alvo_nome, NULLIF(v_rec->>v_nome_campo, ''));

  -- ------------------------------------------------------------- contexto
  IF COALESCE(v_cfg->>'contexto', '') <> '' THEN
    FOR v_campo IN SELECT unnest(string_to_array(v_cfg->>'contexto', ',')) LOOP
      IF v_rec ? v_campo THEN
        v_contexto := v_contexto || jsonb_build_object(
          v_campo, public.formata_valor_log(v_campo, v_rec->v_campo, v_rec)
        );
        IF v_contexto_txt <> '' THEN v_contexto_txt := v_contexto_txt || '; '; END IF;
        v_contexto_txt := v_contexto_txt
          || public.rotulo_campo_log(v_campo) || ': '
          || public.formata_valor_log(v_campo, v_rec->v_campo, v_rec);
      END IF;
    END LOOP;
  END IF;

  -- ------------------------------------------------------------ descrição
  v_descricao := v_descricao_base
    || CASE WHEN COALESCE(v_alvo_nome, '') <> '' THEN ' — ' || v_alvo_nome ELSE '' END
    || CASE WHEN COALESCE(array_length(v_lista, 1), 0) > 0
            THEN ': ' || array_to_string(v_lista[1:8], '; ') ELSE '' END
    || CASE WHEN COALESCE(array_length(v_lista, 1), 0) > 8
            THEN ' (+' || (array_length(v_lista, 1) - 8) || ' alterações)' ELSE '' END
    || CASE WHEN v_contexto_txt <> '' THEN ' (' || v_contexto_txt || ')' ELSE '' END;

  INSERT INTO public.logs_auditoria (
    ator_id, ator_nome, origem, categoria, acao, entidade, entidade_id,
    alvo_id, alvo_nome, descricao, mudancas, detalhes, metodo_pagamento
  ) VALUES (
    v_ator, v_ator_nome, v_origem, v_categoria, v_acao, TG_TABLE_NAME,
    NULLIF(v_rec->>v_id_campo, ''),
    v_alvo_id, v_alvo_nome, v_descricao, v_mudancas,
    jsonb_build_object('operacao', TG_OP) || v_contexto,
    v_metodo
  );

  -- ------------------------------------------------------- notificação
  IF COALESCE(array_length(v_notificar, 1), 0) > 0
     AND EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_mudancas) AS item
        WHERE item->>'campo' = ANY (v_notificar)
     ) THEN
    -- Deixa claro quem fez quando não foi o próprio jogador nem o sistema.
    PERFORM public.notifica_admins(
      'auditoria',
      v_titulo_notif,
      CASE
        WHEN v_origem IN ('painel', 'app') AND COALESCE(v_ator_nome, '') <> ''
          THEN v_ator_nome || ': ' || v_descricao
        ELSE v_descricao
      END,
      v_link
    );
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;

EXCEPTION WHEN OTHERS THEN
  -- Auditoria NUNCA derruba a operação do usuário.
  RAISE WARNING '[logs_auditoria] falha ao registrar (%): %', TG_TABLE_NAME, SQLERRM;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.log_auditoria_generico() FROM PUBLIC, anon, authenticated;

-- ============ 6) Triggers por tabela ============

-- 6.1 Perfil/cadastro — nome, contato, atributos, situação da conta
DROP TRIGGER IF EXISTS trg_audita_perfil ON public.perfis;
DROP TRIGGER IF EXISTS trg_log_perfis ON public.perfis;
CREATE TRIGGER trg_log_perfis AFTER UPDATE ON public.perfis
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"perfil_atualizado","categoria":"perfil","descricao":"Atualizou o cadastro","campos":"nome,telefone,email,email_confirmado,posicao,time_coracao,instagram,ativo,status_conta,avatar_url,ovr,stat_ritmo,stat_finalizacao,stat_passe,stat_drible,stat_defesa,stat_fisico,tema_carta,financeiro_automatico","ignorar":["atualizado_em","nivel_atual","xp_atual","status_pagamento"],"notificar_campos":["nome","telefone","time_coracao","ativo","status_conta"],"titulo_notificacao":"Cadastro alterado","link":"/admin/logs"}');

-- 6.2 Cargos
DROP TRIGGER IF EXISTS trg_log_papeis ON public.papeis_usuario;
CREATE TRIGGER trg_log_papeis AFTER INSERT OR DELETE ON public.papeis_usuario
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"cargo_alterado","categoria":"cargos","descricao":"Alterou o cargo","campos":"papel","link":"/admin/cargos"}');

-- 6.3 Parâmetros do sistema (valores e taxas)
DROP TRIGGER IF EXISTS trg_log_configuracoes ON public.configuracoes;
CREATE TRIGGER trg_log_configuracoes AFTER INSERT OR UPDATE ON public.configuracoes
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"configuracao_alterada","categoria":"financeiro","descricao":"Alterou um parâmetro do sistema","campos":"valor","id":"chave","nome":"chave","contexto":"chave","link":"/admin/financeiro"}');

-- 6.4 Mensalidades — status, valores, multa e forma de pagamento
DROP TRIGGER IF EXISTS trg_log_mensalidades ON public.mensalidades;
CREATE TRIGGER trg_log_mensalidades AFTER UPDATE ON public.mensalidades
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"mensalidade_atualizada","categoria":"financeiro","descricao":"Alterou a mensalidade","campos":"status,mp_status,valor,multa_valor,metodo_pagamento,pago_em,vencimento","ignorar":["atualizado_em","pix_qr_code","pix_qr_base64","pix_expira_em","mp_payment_id","regularizacao_id"],"contexto":"referencia","link":"/admin/financeiro"}');

-- 6.5 Lista do baba — só o que a diretoria faz (entrar/sair, chegada, goleiro, valores)
DROP TRIGGER IF EXISTS trg_log_presencas_diretoria ON public.presencas;
CREATE TRIGGER trg_log_presencas_diretoria AFTER INSERT OR UPDATE OR DELETE ON public.presencas
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"lista_alterada","categoria":"lista","descricao":"Alterou a lista do baba","campos":"nome_convidado,valor,is_goleiro_fixo,compareceu,ordem_chegada,chegou_em,usuario_id,convidado_user_id","somente_diretoria":true,"link":"/baba"}');

-- 6.6 Pagamento da diária do convidado (qualquer ator)
DROP TRIGGER IF EXISTS trg_log_presencas_pagamento ON public.presencas;
CREATE TRIGGER trg_log_presencas_pagamento AFTER UPDATE ON public.presencas
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"convidado_pagamento","categoria":"pagamento","descricao":"Pagamento da diária do convidado","campos":"status_convidado,mp_status,metodo_pagamento,valor","ignorar":["atualizado_em"],"link":"/admin/financeiro"}');

-- 6.7 Contribuições de metas
DROP TRIGGER IF EXISTS trg_log_contribuicoes_meta ON public.contribuicoes_meta;
CREATE TRIGGER trg_log_contribuicoes_meta AFTER UPDATE ON public.contribuicoes_meta
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"contribuicao_alterada","categoria":"metas","descricao":"Alterou uma contribuição de meta","campos":"valor,anonima,nome_camisa,tamanho,numero_camisa","ignorar":["confirmada_em"],"link":"/admin/metas"}');

DROP TRIGGER IF EXISTS trg_log_contribuicoes_meta_pagamento ON public.contribuicoes_meta;
CREATE TRIGGER trg_log_contribuicoes_meta_pagamento AFTER UPDATE ON public.contribuicoes_meta
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"contribuicao_pagamento","categoria":"pagamento","descricao":"Pagamento de contribuição de meta","campos":"status,metodo_pagamento","ignorar":["atualizado_em"],"link":"/admin/metas"}');

-- 6.8 Regularização (retomada de vínculo)
DROP TRIGGER IF EXISTS trg_log_regularizacoes ON public.regularizacoes;
CREATE TRIGGER trg_log_regularizacoes AFTER UPDATE ON public.regularizacoes
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"regularizacao_atualizada","categoria":"pagamento","descricao":"Alterou a regularização do associado","campos":"status,metodo_pagamento,valor_total,valor_debitos,taxa_associacao,pago_em","contexto":"valor_total","link":"/admin/financeiro"}');

-- 6.9 Punições
DROP TRIGGER IF EXISTS trg_log_suspensoes ON public.suspensoes;
CREATE TRIGGER trg_log_suspensoes AFTER INSERT OR DELETE ON public.suspensoes
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"punicao_alterada","categoria":"punicoes","descricao":"Alterou uma punição","campos":"motivo,origem,baba_bloqueado_id,baba_origem_id","ignorar":["criado_em"],"link":"/admin/usuarios"}');

-- 6.10 Convidados e aprovações
DROP TRIGGER IF EXISTS trg_log_convidados_cadastro ON public.convidados_cadastro;
CREATE TRIGGER trg_log_convidados_cadastro AFTER UPDATE ON public.convidados_cadastro
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"convidado_atualizado","categoria":"convidados","descricao":"Alterou o cadastro do convidado","campos":"nome,telefone,aprovado,bloqueado","ignorar":["atualizado_em"],"id":"id","nome":"nome","link":"/admin/usuarios"}');

DROP TRIGGER IF EXISTS trg_log_pedidos_convidado ON public.pedidos_convidado;
CREATE TRIGGER trg_log_pedidos_convidado AFTER INSERT OR UPDATE ON public.pedidos_convidado
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"pedido_convidado","categoria":"convidados","descricao":"Alterou um pedido de convidado","campos":"status,presenca_id,decidido_por,convidado_id","ignorar":["atualizado_em"],"alvo":"anfitriao_id","nome":"","link":"/admin/usuarios"}');

DROP TRIGGER IF EXISTS trg_log_ajustes_babas ON public.ajustes_babas_convidado;
CREATE TRIGGER trg_log_ajustes_babas AFTER INSERT OR UPDATE OR DELETE ON public.ajustes_babas_convidado
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"ajuste_babas_alterado","categoria":"convidados","descricao":"Ajustou os babas pagos do convidado","campos":"babas_credito,observacao","ignorar":["criado_em","atualizado_em","atualizado_por"],"id":"usuario_id","link":"/admin/usuarios"}');

-- 6.11 Associação (aprovações da diretoria)
DROP TRIGGER IF EXISTS trg_log_solicitacoes_associacao ON public.solicitacoes_associacao;
CREATE TRIGGER trg_log_solicitacoes_associacao AFTER INSERT OR UPDATE ON public.solicitacoes_associacao
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"solicitacao_associacao","categoria":"associacao","descricao":"Alterou uma solicitação de associação","campos":"status,decidido_por,motivo","ignorar":["atualizado_em"],"link":"/admin/usuarios"}');

-- 6.12 Metas
DROP TRIGGER IF EXISTS trg_log_metas ON public.metas;
CREATE TRIGGER trg_log_metas AFTER INSERT OR UPDATE ON public.metas
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"meta_alterada","categoria":"metas","descricao":"Alterou uma meta","campos":"titulo,descricao,categoria,status,valor_alvo,valor_item,tipo_arrecadacao,tamanho_padrao,exige_personalizacao,prazo,prazo_cadastro,prazo_pagamento,imagem_url","ignorar":["atualizado_em","valor_arrecadado","criado_por"],"nome":"titulo","link":"/admin/metas"}');

-- 6.13 Agenda da arena
DROP TRIGGER IF EXISTS trg_log_arena_eventos ON public.arena_eventos;
CREATE TRIGGER trg_log_arena_eventos AFTER INSERT OR UPDATE OR DELETE ON public.arena_eventos
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"agenda_alterada","categoria":"agenda","descricao":"Alterou a agenda da arena","campos":"titulo,descricao,categoria,status,data_evento,hora_inicio,hora_fim,local,organizador,vagas","ignorar":["atualizado_em","criado_por"],"nome":"titulo","contexto":"data_evento","link":"/admin/agenda"}');

-- 6.14 Sessões do baba
DROP TRIGGER IF EXISTS trg_log_sessoes_baba ON public.sessoes_baba;
CREATE TRIGGER trg_log_sessoes_baba AFTER INSERT OR UPDATE OR DELETE ON public.sessoes_baba
FOR EACH ROW EXECUTE FUNCTION public.log_auditoria_generico('{"acao":"baba_alterado","categoria":"sessoes","descricao":"Alterou uma sessão do baba","campos":"data_horario,local,fechamento_lista,abertura_lista,esta_fechado","ignorar":["atualizado_em"],"nome":"local","contexto":"data_horario","link":"/admin"}');

-- ============ 7) Forma de pagamento exposta à diretoria ============
DROP FUNCTION IF EXISTS public.status_pagamento_presencas(uuid);
CREATE OR REPLACE FUNCTION public.status_pagamento_presencas(_baba_id uuid)
RETURNS TABLE(presenca_id uuid, mp_status text, metodo_pagamento text, valor numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.mp_status,
    p.metodo_pagamento,
    CASE WHEN public.eh_diretoria(auth.uid()) THEN p.valor ELSE NULL END
  FROM public.presencas p
  WHERE p.baba_id = _baba_id
    AND (
      public.eh_diretoria(auth.uid())
      OR p.usuario_id = auth.uid()
      OR p.convidado_user_id = auth.uid()
    );
$$;
REVOKE ALL ON FUNCTION public.status_pagamento_presencas(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.status_pagamento_presencas(uuid) TO authenticated, service_role;
