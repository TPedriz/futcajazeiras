export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ajustes_babas_convidado: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          babas_credito: number
          criado_em: string
          observacao: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          babas_credito?: number
          criado_em?: string
          observacao?: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          babas_credito?: number
          criado_em?: string
          observacao?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ajustes_babas_convidado_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ajustes_babas_convidado_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes: {
        Row: {
          atualizado_em: string
          chave: string
          valor: number
        }
        Insert: {
          atualizado_em?: string
          chave: string
          valor: number
        }
        Update: {
          atualizado_em?: string
          chave?: string
          valor?: number
        }
        Relationships: []
      }
      conquistas: {
        Row: {
          categoria: string
          codigo: string
          cor: string
          criado_em: string
          descricao: string
          icone: string
          id: string
          meta: number
          nome: string
        }
        Insert: {
          categoria: string
          codigo: string
          cor?: string
          criado_em?: string
          descricao: string
          icone?: string
          id?: string
          meta: number
          nome: string
        }
        Update: {
          categoria?: string
          codigo?: string
          cor?: string
          criado_em?: string
          descricao?: string
          icone?: string
          id?: string
          meta?: number
          nome?: string
        }
        Relationships: []
      }
      convidados_cadastro: {
        Row: {
          aprovado: boolean
          atualizado_em: string
          bloqueado: boolean
          criado_em: string
          criado_por: string | null
          id: string
          nome: string
          telefone: string
          user_id: string | null
        }
        Insert: {
          aprovado?: boolean
          atualizado_em?: string
          bloqueado?: boolean
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome: string
          telefone: string
          user_id?: string | null
        }
        Update: {
          aprovado?: boolean
          atualizado_em?: string
          bloqueado?: boolean
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome?: string
          telefone?: string
          user_id?: string | null
        }
        Relationships: []
      }
      estatisticas_baba: {
        Row: {
          assistencias: number
          atualizado_em: string
          baba_id: string
          cartoes_amarelos: number
          cartoes_azuis: number
          cartoes_vermelhos: number
          criado_em: string
          gols: number
          id: string
          penaltis_defendidos: number
          usuario_id: string
        }
        Insert: {
          assistencias?: number
          atualizado_em?: string
          baba_id: string
          cartoes_amarelos?: number
          cartoes_azuis?: number
          cartoes_vermelhos?: number
          criado_em?: string
          gols?: number
          id?: string
          penaltis_defendidos?: number
          usuario_id: string
        }
        Update: {
          assistencias?: number
          atualizado_em?: string
          baba_id?: string
          cartoes_amarelos?: number
          cartoes_azuis?: number
          cartoes_vermelhos?: number
          criado_em?: string
          gols?: number
          id?: string
          penaltis_defendidos?: number
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "estatisticas_baba_baba_id_fkey"
            columns: ["baba_id"]
            isOneToOne: false
            referencedRelation: "sessoes_baba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estatisticas_baba_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      locais_baba: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          latitude: number
          longitude: number
          nome: string
          raio_metros: number
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          latitude: number
          longitude: number
          nome: string
          raio_metros?: number
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          latitude?: number
          longitude?: number
          nome?: string
          raio_metros?: number
        }
        Relationships: []
      }
      mensalidades: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          mp_payment_id: string | null
          mp_status: string | null
          pago_em: string | null
          pix_expira_em: string | null
          pix_qr_base64: string | null
          pix_qr_code: string | null
          referencia: string
          status: Database["public"]["Enums"]["status_pagamento"]
          usuario_id: string
          valor: number
          vencimento: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          mp_payment_id?: string | null
          mp_status?: string | null
          pago_em?: string | null
          pix_expira_em?: string | null
          pix_qr_base64?: string | null
          pix_qr_code?: string | null
          referencia: string
          status?: Database["public"]["Enums"]["status_pagamento"]
          usuario_id: string
          valor?: number
          vencimento: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          mp_payment_id?: string | null
          mp_status?: string | null
          pago_em?: string | null
          pix_expira_em?: string | null
          pix_qr_base64?: string | null
          pix_qr_code?: string | null
          referencia?: string
          status?: Database["public"]["Enums"]["status_pagamento"]
          usuario_id?: string
          valor?: number
          vencimento?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensalidades_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          criado_em: string
          id: string
          lida: boolean
          link: string | null
          mensagem: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tipo?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          lida?: boolean
          link?: string | null
          mensagem?: string
          tipo?: string
          titulo?: string
          usuario_id?: string
        }
        Relationships: []
      }
      papeis_usuario: {
        Row: {
          criado_em: string
          id: string
          papel: Database["public"]["Enums"]["papel_usuario"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          papel: Database["public"]["Enums"]["papel_usuario"]
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          papel?: Database["public"]["Enums"]["papel_usuario"]
          user_id?: string
        }
        Relationships: []
      }
      pedidos_convidado: {
        Row: {
          anfitriao_id: string
          atualizado_em: string
          baba_id: string
          convidado_id: string
          criado_em: string
          decidido_por: string | null
          id: string
          presenca_id: string | null
          solicitacao_id: string | null
          status: Database["public"]["Enums"]["status_convidado"]
        }
        Insert: {
          anfitriao_id: string
          atualizado_em?: string
          baba_id: string
          convidado_id: string
          criado_em?: string
          decidido_por?: string | null
          id?: string
          presenca_id?: string | null
          solicitacao_id?: string | null
          status?: Database["public"]["Enums"]["status_convidado"]
        }
        Update: {
          anfitriao_id?: string
          atualizado_em?: string
          baba_id?: string
          convidado_id?: string
          criado_em?: string
          decidido_por?: string | null
          id?: string
          presenca_id?: string | null
          solicitacao_id?: string | null
          status?: Database["public"]["Enums"]["status_convidado"]
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_convidado_baba_id_fkey"
            columns: ["baba_id"]
            isOneToOne: false
            referencedRelation: "sessoes_baba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_convidado_convidado_id_fkey"
            columns: ["convidado_id"]
            isOneToOne: false
            referencedRelation: "convidados_cadastro"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_convidado_presenca_id_fkey"
            columns: ["presenca_id"]
            isOneToOne: false
            referencedRelation: "presencas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_convidado_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "solicitacoes_convidado"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          ativo: boolean
          atualizado_em: string
          avatar_url: string | null
          criado_em: string
          email: string
          id: string
          nivel_atual: number
          nome: string
          ovr: number
          posicao: Database["public"]["Enums"]["posicao_jogador"]
          stat_defesa: number
          stat_drible: number
          stat_finalizacao: number
          stat_fisico: number
          stat_passe: number
          stat_ritmo: number
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          telefone: string
          tema_carta: string
          time_coracao: Database["public"]["Enums"]["time_coracao"] | null
          xp_atual: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          avatar_url?: string | null
          criado_em?: string
          email: string
          id: string
          nivel_atual?: number
          nome: string
          ovr?: number
          posicao?: Database["public"]["Enums"]["posicao_jogador"]
          stat_defesa?: number
          stat_drible?: number
          stat_finalizacao?: number
          stat_fisico?: number
          stat_passe?: number
          stat_ritmo?: number
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          telefone?: string
          tema_carta?: string
          time_coracao?: Database["public"]["Enums"]["time_coracao"] | null
          xp_atual?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          avatar_url?: string | null
          criado_em?: string
          email?: string
          id?: string
          nivel_atual?: number
          nome?: string
          ovr?: number
          posicao?: Database["public"]["Enums"]["posicao_jogador"]
          stat_defesa?: number
          stat_drible?: number
          stat_finalizacao?: number
          stat_fisico?: number
          stat_passe?: number
          stat_ritmo?: number
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          telefone?: string
          tema_carta?: string
          time_coracao?: Database["public"]["Enums"]["time_coracao"] | null
          xp_atual?: number
        }
        Relationships: []
      }
      perfis_publicos: {
        Row: {
          ativo: boolean
          avatar_url: string | null
          id: string
          nome: string
          posicao: Database["public"]["Enums"]["posicao_jogador"]
          time_coracao: Database["public"]["Enums"]["time_coracao"] | null
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          id: string
          nome: string
          posicao?: Database["public"]["Enums"]["posicao_jogador"]
          time_coracao?: Database["public"]["Enums"]["time_coracao"] | null
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          id?: string
          nome?: string
          posicao?: Database["public"]["Enums"]["posicao_jogador"]
          time_coracao?: Database["public"]["Enums"]["time_coracao"] | null
        }
        Relationships: [
          {
            foreignKeyName: "perfis_publicos_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas: {
        Row: {
          baba_id: string
          chegou_em: string | null
          compareceu: boolean | null
          confirmado_em: string
          convidado_cadastro_id: string | null
          convidado_user_id: string | null
          id: string
          is_goleiro_fixo: boolean
          mp_status: string | null
          nome_convidado: string | null
          ordem_chegada: number | null
          status_convidado:
            | Database["public"]["Enums"]["status_convidado"]
            | null
          usuario_id: string
          valor: number
        }
        Insert: {
          baba_id: string
          chegou_em?: string | null
          compareceu?: boolean | null
          confirmado_em?: string
          convidado_cadastro_id?: string | null
          convidado_user_id?: string | null
          id?: string
          is_goleiro_fixo?: boolean
          mp_status?: string | null
          nome_convidado?: string | null
          ordem_chegada?: number | null
          status_convidado?:
            | Database["public"]["Enums"]["status_convidado"]
            | null
          usuario_id: string
          valor?: number
        }
        Update: {
          baba_id?: string
          chegou_em?: string | null
          compareceu?: boolean | null
          confirmado_em?: string
          convidado_cadastro_id?: string | null
          convidado_user_id?: string | null
          id?: string
          is_goleiro_fixo?: boolean
          mp_status?: string | null
          nome_convidado?: string | null
          ordem_chegada?: number | null
          status_convidado?:
            | Database["public"]["Enums"]["status_convidado"]
            | null
          usuario_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "presencas_baba_id_fkey"
            columns: ["baba_id"]
            isOneToOne: false
            referencedRelation: "sessoes_baba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presencas_convidado_cadastro_id_fkey"
            columns: ["convidado_cadastro_id"]
            isOneToOne: false
            referencedRelation: "convidados_cadastro"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas_contato: {
        Row: {
          criado_em: string
          presenca_id: string
          telefone: string
        }
        Insert: {
          criado_em?: string
          presenca_id: string
          telefone?: string
        }
        Update: {
          criado_em?: string
          presenca_id?: string
          telefone?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencas_contato_presenca_id_fkey"
            columns: ["presenca_id"]
            isOneToOne: true
            referencedRelation: "presencas"
            referencedColumns: ["id"]
          },
        ]
      }
      presencas_pagamento: {
        Row: {
          atualizado_em: string
          criado_em: string
          mp_payment_id: string | null
          pix_expira_em: string | null
          pix_qr_base64: string | null
          pix_qr_code: string | null
          presenca_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          mp_payment_id?: string | null
          pix_expira_em?: string | null
          pix_qr_base64?: string | null
          pix_qr_code?: string | null
          presenca_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          mp_payment_id?: string | null
          pix_expira_em?: string | null
          pix_qr_base64?: string | null
          pix_qr_code?: string | null
          presenca_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presencas_pagamento_presenca_id_fkey"
            columns: ["presenca_id"]
            isOneToOne: true
            referencedRelation: "presencas"
            referencedColumns: ["id"]
          },
        ]
      }
      sessoes_baba: {
        Row: {
          abertura_lista: string | null
          atualizado_em: string
          criado_em: string
          data_horario: string
          esta_fechado: boolean
          fechamento_lista: string | null
          id: string
          latitude: number
          local: string
          longitude: number
          mostrar_lista_chegada: boolean
          raio_metros: number
        }
        Insert: {
          abertura_lista?: string | null
          atualizado_em?: string
          criado_em?: string
          data_horario: string
          esta_fechado?: boolean
          fechamento_lista?: string | null
          id?: string
          latitude?: number
          local: string
          longitude?: number
          mostrar_lista_chegada?: boolean
          raio_metros?: number
        }
        Update: {
          abertura_lista?: string | null
          atualizado_em?: string
          criado_em?: string
          data_horario?: string
          esta_fechado?: boolean
          fechamento_lista?: string | null
          id?: string
          latitude?: number
          local?: string
          longitude?: number
          mostrar_lista_chegada?: boolean
          raio_metros?: number
        }
        Relationships: []
      }
      solicitacoes_associacao: {
        Row: {
          atualizado_em: string
          criado_em: string
          decidido_por: string | null
          id: string
          observacao: string
          status: Database["public"]["Enums"]["status_solicitacao_assoc"]
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          decidido_por?: string | null
          id?: string
          observacao?: string
          status?: Database["public"]["Enums"]["status_solicitacao_assoc"]
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          decidido_por?: string | null
          id?: string
          observacao?: string
          status?: Database["public"]["Enums"]["status_solicitacao_assoc"]
          usuario_id?: string
        }
        Relationships: []
      }
      solicitacoes_convidado: {
        Row: {
          anfitriao_id: string
          atualizado_em: string
          baba_id: string
          criado_em: string
          id: string
          presenca_id: string | null
          solicitante_id: string
          status: Database["public"]["Enums"]["status_convidado"]
        }
        Insert: {
          anfitriao_id: string
          atualizado_em?: string
          baba_id: string
          criado_em?: string
          id?: string
          presenca_id?: string | null
          solicitante_id: string
          status?: Database["public"]["Enums"]["status_convidado"]
        }
        Update: {
          anfitriao_id?: string
          atualizado_em?: string
          baba_id?: string
          criado_em?: string
          id?: string
          presenca_id?: string | null
          solicitante_id?: string
          status?: Database["public"]["Enums"]["status_convidado"]
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_convidado_baba_id_fkey"
            columns: ["baba_id"]
            isOneToOne: false
            referencedRelation: "sessoes_baba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "solicitacoes_convidado_presenca_id_fkey"
            columns: ["presenca_id"]
            isOneToOne: false
            referencedRelation: "presencas"
            referencedColumns: ["id"]
          },
        ]
      }
      suspensoes: {
        Row: {
          baba_bloqueado_id: string | null
          baba_origem_id: string | null
          criado_em: string
          id: string
          motivo: string
          origem: string
          usuario_id: string
        }
        Insert: {
          baba_bloqueado_id?: string | null
          baba_origem_id?: string | null
          criado_em?: string
          id?: string
          motivo?: string
          origem?: string
          usuario_id: string
        }
        Update: {
          baba_bloqueado_id?: string | null
          baba_origem_id?: string | null
          criado_em?: string
          id?: string
          motivo?: string
          origem?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "suspensoes_baba_bloqueado_id_fkey"
            columns: ["baba_bloqueado_id"]
            isOneToOne: false
            referencedRelation: "sessoes_baba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suspensoes_baba_origem_id_fkey"
            columns: ["baba_origem_id"]
            isOneToOne: false
            referencedRelation: "sessoes_baba"
            referencedColumns: ["id"]
          },
        ]
      }
      times_baba: {
        Row: {
          atualizado_em: string
          baba_id: string
          criado_em: string
          id: string
          nome: string
          resultado: Database["public"]["Enums"]["resultado_time"] | null
        }
        Insert: {
          atualizado_em?: string
          baba_id: string
          criado_em?: string
          id?: string
          nome: string
          resultado?: Database["public"]["Enums"]["resultado_time"] | null
        }
        Update: {
          atualizado_em?: string
          baba_id?: string
          criado_em?: string
          id?: string
          nome?: string
          resultado?: Database["public"]["Enums"]["resultado_time"] | null
        }
        Relationships: [
          {
            foreignKeyName: "times_baba_baba_id_fkey"
            columns: ["baba_id"]
            isOneToOne: false
            referencedRelation: "sessoes_baba"
            referencedColumns: ["id"]
          },
        ]
      }
      times_jogadores: {
        Row: {
          criado_em: string
          id: string
          nome_convidado: string | null
          posicao: Database["public"]["Enums"]["posicao_jogador"]
          time_id: string
          usuario_id: string | null
        }
        Insert: {
          criado_em?: string
          id?: string
          nome_convidado?: string | null
          posicao?: Database["public"]["Enums"]["posicao_jogador"]
          time_id: string
          usuario_id?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          nome_convidado?: string | null
          posicao?: Database["public"]["Enums"]["posicao_jogador"]
          time_id?: string
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "times_jogadores_time_id_fkey"
            columns: ["time_id"]
            isOneToOne: false
            referencedRelation: "times_baba"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "times_jogadores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_conquistas: {
        Row: {
          conquista_id: string
          desbloqueada_em: string
          em_destaque: boolean
          id: string
          ordem_destaque: number | null
          usuario_id: string
        }
        Insert: {
          conquista_id: string
          desbloqueada_em?: string
          em_destaque?: boolean
          id?: string
          ordem_destaque?: number | null
          usuario_id: string
        }
        Update: {
          conquista_id?: string
          desbloqueada_em?: string
          em_destaque?: boolean
          id?: string
          ordem_destaque?: number | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_conquistas_conquista_id_fkey"
            columns: ["conquista_id"]
            isOneToOne: false
            referencedRelation: "conquistas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_conquistas_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      ranking_mensal: {
        Row: {
          assistencias: number | null
          cartoes_amarelos: number | null
          cartoes_azuis: number | null
          cartoes_vermelhos: number | null
          derrotas: number | null
          empates: number | null
          gols: number | null
          mes: string | null
          nome: string | null
          penaltis_defendidos: number | null
          posicao: Database["public"]["Enums"]["posicao_jogador"] | null
          usuario_id: string | null
          vitorias: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      aplica_suspensao: {
        Args: {
          _motivo: string
          _origem: string
          _origem_baba: string
          _quantidade: number
          _usuario_id: string
        }
        Returns: number
      }
      babas_pagos_convidado: { Args: { _user_id: string }; Returns: number }
      calcula_cartinha: { Args: { usuario: string }; Returns: undefined }
      concede_xp: {
        Args: { quantidade: number; usuario: string }
        Returns: number
      }
      config_int: { Args: { _chave: string; _padrao: number }; Returns: number }
      criar_pedido_convidado: {
        Args: {
          _baba_id: string
          _convidado_id?: string
          _nome: string
          _telefone: string
        }
        Returns: {
          convidado_id: string
          pedido_id: string
          status: Database["public"]["Enums"]["status_convidado"]
        }[]
      }
      decidir_pedido_convidado: {
        Args: { _aprovar: boolean; _pedido_id: string }
        Returns: undefined
      }
      desbloqueia_conquista: {
        Args: { conquista: string; usuario: string }
        Returns: undefined
      }
      garante_mensalidade: {
        Args: { _referencia: string; _usuario_id: string }
        Returns: string
      }
      garante_mensalidades_mes: { Args: never; Returns: undefined }
      marcar_chegada: {
        Args: { _lat: number; _lng: number; _presenca_id: string }
        Returns: number
      }
      nivel_para_xp: { Args: { xp: number }; Returns: number }
      notifica: {
        Args: {
          _link?: string
          _mensagem: string
          _tipo: string
          _titulo: string
          _usuario_id: string
        }
        Returns: undefined
      }
      notifica_admins: {
        Args: {
          _link?: string
          _mensagem: string
          _tipo: string
          _titulo: string
        }
        Returns: undefined
      }
      solicita_convite: {
        Args: { _anfitriao_id: string; _baba_id: string }
        Returns: string
      }
      telefone_convidado: { Args: { _convidado_id: string }; Returns: string }
      tem_papel: {
        Args: {
          _papel: Database["public"]["Enums"]["papel_usuario"]
          _user_id: string
        }
        Returns: boolean
      }
      total_associados_ativos: { Args: never; Returns: number }
      valor_mensalidade: { Args: never; Returns: number }
      verifica_conquistas: { Args: { usuario: string }; Returns: undefined }
      xp_necessaria_para_nivel: { Args: { nivel: number }; Returns: number }
    }
    Enums: {
      papel_usuario: "administrador" | "associado" | "convidado"
      posicao_jogador: "goleiro" | "linha"
      resultado_time: "vitoria" | "derrota" | "empate"
      status_convidado: "pendente" | "aprovado" | "rejeitado"
      status_pagamento: "pago" | "pendente"
      status_solicitacao_assoc: "pendente" | "aprovado" | "rejeitado"
      time_coracao: "bahia" | "vitoria"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      papel_usuario: ["administrador", "associado", "convidado"],
      posicao_jogador: ["goleiro", "linha"],
      resultado_time: ["vitoria", "derrota", "empate"],
      status_convidado: ["pendente", "aprovado", "rejeitado"],
      status_pagamento: ["pago", "pendente"],
      status_solicitacao_assoc: ["pendente", "aprovado", "rejeitado"],
      time_coracao: ["bahia", "vitoria"],
    },
  },
} as const
