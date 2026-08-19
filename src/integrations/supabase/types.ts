export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      ajustes_babas_convidado: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          babas_credito: number;
          criado_em: string;
          observacao: string;
          usuario_id: string;
        };
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          babas_credito?: number;
          criado_em?: string;
          observacao?: string;
          usuario_id: string;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          babas_credito?: number;
          criado_em?: string;
          observacao?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ajustes_babas_convidado_atualizado_por_fkey";
            columns: ["atualizado_por"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
          {
<<<<<<< HEAD
            foreignKeyName: "ajustes_babas_convidado_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
=======
            foreignKeyName: "ajustes_babas_convidado_atualizado_por_fkey";
            columns: ["atualizado_por"];
            isOneToOne: false;
            referencedRelation: "ranking_cartinhas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ajustes_babas_convidado_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: true;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ajustes_babas_convidado_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: true;
            referencedRelation: "ranking_cartinhas";
            referencedColumns: ["id"];
          },
        ];
      };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
      bavi_relacionados: {
        Row: {
          baba_id: string;
          criado_em: string;
          id: string;
          posicao: Database["public"]["Enums"]["posicao_jogador"];
          time_nome: string;
          usuario_id: string;
        };
        Insert: {
          baba_id: string;
          criado_em?: string;
          id?: string;
          posicao?: Database["public"]["Enums"]["posicao_jogador"];
          time_nome: string;
          usuario_id: string;
        };
        Update: {
          baba_id?: string;
          criado_em?: string;
          id?: string;
          posicao?: Database["public"]["Enums"]["posicao_jogador"];
          time_nome?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "bavi_relacionados_baba_id_fkey";
            columns: ["baba_id"];
            isOneToOne: false;
            referencedRelation: "sessoes_baba";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "bavi_relacionados_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
<<<<<<< HEAD
        ]
      }
=======
          {
            foreignKeyName: "bavi_relacionados_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "ranking_cartinhas";
            referencedColumns: ["id"];
          },
        ];
      };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
      configuracoes: {
        Row: {
          atualizado_em: string;
          chave: string;
          valor: number;
        };
        Insert: {
          atualizado_em?: string;
          chave: string;
          valor: number;
        };
        Update: {
          atualizado_em?: string;
          chave?: string;
          valor?: number;
        };
        Relationships: [];
      };
      conquistas: {
        Row: {
<<<<<<< HEAD
          categoria: string
          codigo: string
          cor: string
          criado_em: string
          descricao: string
          historica: boolean
          icone: string
          id: string
          meta: number
          nome: string
          raridade: string
        }
        Insert: {
          categoria: string
          codigo: string
          cor?: string
          criado_em?: string
          descricao: string
          historica?: boolean
          icone?: string
          id?: string
          meta: number
          nome: string
          raridade?: string
        }
        Update: {
          categoria?: string
          codigo?: string
          cor?: string
          criado_em?: string
          descricao?: string
          historica?: boolean
          icone?: string
          id?: string
          meta?: number
          nome?: string
          raridade?: string
        }
        Relationships: []
      }
=======
          categoria: string;
          codigo: string;
          cor: string;
          criado_em: string;
          descricao: string;
          historica: boolean;
          icone: string;
          id: string;
          meta: number;
          nome: string;
          raridade: string;
        };
        Insert: {
          categoria: string;
          codigo: string;
          cor?: string;
          criado_em?: string;
          descricao: string;
          historica?: boolean;
          icone?: string;
          id?: string;
          meta: number;
          nome: string;
          raridade?: string;
        };
        Update: {
          categoria?: string;
          codigo?: string;
          cor?: string;
          criado_em?: string;
          descricao?: string;
          historica?: boolean;
          icone?: string;
          id?: string;
          meta?: number;
          nome?: string;
          raridade?: string;
        };
        Relationships: [];
      };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
      convidados_cadastro: {
        Row: {
          aprovado: boolean;
          atualizado_em: string;
          bloqueado: boolean;
          criado_em: string;
          criado_por: string | null;
          id: string;
          nome: string;
          telefone: string;
          user_id: string | null;
        };
        Insert: {
          aprovado?: boolean;
          atualizado_em?: string;
          bloqueado?: boolean;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          nome: string;
          telefone: string;
          user_id?: string | null;
        };
        Update: {
          aprovado?: boolean;
          atualizado_em?: string;
          bloqueado?: boolean;
          criado_em?: string;
          criado_por?: string | null;
          id?: string;
          nome?: string;
          telefone?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      estatisticas_baba: {
        Row: {
          assistencias: number;
          atualizado_em: string;
          baba_id: string;
          cartoes_amarelos: number;
          cartoes_azuis: number;
          cartoes_vermelhos: number;
          criado_em: string;
          faltas: number;
          gols: number;
          gols_contra: number;
          id: string;
          penaltis_defendidos: number;
          usuario_id: string;
        };
        Insert: {
          assistencias?: number;
          atualizado_em?: string;
          baba_id: string;
          cartoes_amarelos?: number;
          cartoes_azuis?: number;
          cartoes_vermelhos?: number;
          criado_em?: string;
          faltas?: number;
          gols?: number;
          gols_contra?: number;
          id?: string;
          penaltis_defendidos?: number;
          usuario_id: string;
        };
        Update: {
          assistencias?: number;
          atualizado_em?: string;
          baba_id?: string;
          cartoes_amarelos?: number;
          cartoes_azuis?: number;
          cartoes_vermelhos?: number;
          criado_em?: string;
          faltas?: number;
          gols?: number;
          gols_contra?: number;
          id?: string;
          penaltis_defendidos?: number;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "estatisticas_baba_baba_id_fkey";
            columns: ["baba_id"];
            isOneToOne: false;
            referencedRelation: "sessoes_baba";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estatisticas_baba_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estatisticas_baba_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "ranking_cartinhas";
            referencedColumns: ["id"];
          },
<<<<<<< HEAD
        ]
      }
=======
        ];
      };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
      feed_eventos: {
        Row: {
          chave_unica: string
          conquista_id: string | null
          criado_em: string
          descricao: string
          id: string
          metadata: Json
          tipo: string
          titulo: string
          usuario_id: string
          visibilidade: string
        }
        Insert: {
          chave_unica: string
          conquista_id?: string | null
          criado_em?: string
          descricao?: string
          id?: string
          metadata?: Json
          tipo: string
          titulo: string
          usuario_id: string
          visibilidade?: string
        }
        Update: {
          chave_unica?: string
          conquista_id?: string | null
          criado_em?: string
          descricao?: string
          id?: string
          metadata?: Json
          tipo?: string
          titulo?: string
          usuario_id?: string
          visibilidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "feed_eventos_conquista_id_fkey"
            columns: ["conquista_id"]
            isOneToOne: false
            referencedRelation: "conquistas"
            referencedColumns: ["id"]
          },
          {
<<<<<<< HEAD
            foreignKeyName: "feed_eventos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
=======
            foreignKeyName: "feed_eventos_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
        ];
      };
      feed_likes: {
        Row: {
          criado_em: string;
          feed_evento_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          criado_em?: string;
          feed_evento_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          criado_em?: string;
          feed_evento_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feed_likes_feed_evento_id_fkey";
            columns: ["feed_evento_id"];
            isOneToOne: false;
            referencedRelation: "feed_eventos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "feed_likes_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
        ];
      };
      arena_eventos: {
        Row: {
          atualizado_em: string;
          categoria: string;
          criado_em: string;
          criado_por: string | null;
          data_evento: string;
          descricao: string;
          hora_fim: string | null;
          hora_inicio: string;
          id: string;
          local: string;
          organizador: string;
          status: string;
          titulo: string;
          vagas: number | null;
        };
        Insert: {
          atualizado_em?: string;
          categoria?: string;
          criado_em?: string;
          criado_por?: string | null;
          data_evento: string;
          descricao?: string;
          hora_fim?: string | null;
          hora_inicio: string;
          id?: string;
          local?: string;
          organizador?: string;
          status?: string;
          titulo: string;
          vagas?: number | null;
        };
        Update: {
          atualizado_em?: string;
          categoria?: string;
          criado_em?: string;
          criado_por?: string | null;
          data_evento?: string;
          descricao?: string;
          hora_fim?: string | null;
          hora_inicio?: string;
          id?: string;
          local?: string;
          organizador?: string;
          status?: string;
          titulo?: string;
          vagas?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "arena_eventos_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
        ];
      };
      metas: {
        Row: {
          atualizado_em: string;
          categoria: string;
          criado_em: string;
          criado_por: string | null;
          descricao: string;
          id: string;
          imagem_url: string | null;
          prazo: string | null;
          status: string;
          titulo: string;
          valor_alvo: number;
          valor_arrecadado: number;
        };
        Insert: {
          atualizado_em?: string;
          categoria?: string;
          criado_em?: string;
          criado_por?: string | null;
          descricao?: string;
          id?: string;
          imagem_url?: string | null;
          prazo?: string | null;
          status?: string;
          titulo: string;
          valor_alvo: number;
          valor_arrecadado?: number;
        };
        Update: {
          atualizado_em?: string;
          categoria?: string;
          criado_em?: string;
          criado_por?: string | null;
          descricao?: string;
          id?: string;
          imagem_url?: string | null;
          prazo?: string | null;
          status?: string;
          titulo?: string;
          valor_alvo?: number;
          valor_arrecadado?: number;
        };
        Relationships: [
          {
            foreignKeyName: "metas_criado_por_fkey";
            columns: ["criado_por"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
        ];
      };
      contribuicoes_meta: {
        Row: {
          anonima: boolean;
          confirmada_em: string | null;
          criado_em: string;
          id: string;
          meta_id: string;
          status: string;
          user_id: string;
          valor: number;
        };
        Insert: {
          anonima?: boolean;
          confirmada_em?: string | null;
          criado_em?: string;
          id?: string;
          meta_id: string;
          status?: string;
          user_id: string;
          valor: number;
        };
        Update: {
          anonima?: boolean;
          confirmada_em?: string | null;
          criado_em?: string;
          id?: string;
          meta_id?: string;
          status?: string;
          user_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "contribuicoes_meta_meta_id_fkey";
            columns: ["meta_id"];
            isOneToOne: false;
            referencedRelation: "metas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contribuicoes_meta_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
        ];
      };
      contribuicoes_meta_pagamento: {
        Row: {
          contribuicao_id: string;
          criado_em: string;
          mp_payment_id: string | null;
          pix_expira_em: string | null;
          pix_qr_base64: string | null;
          pix_qr_code: string | null;
        };
        Insert: {
          contribuicao_id: string;
          criado_em?: string;
          mp_payment_id?: string | null;
          pix_expira_em?: string | null;
          pix_qr_base64?: string | null;
          pix_qr_code?: string | null;
        };
        Update: {
          contribuicao_id?: string;
          criado_em?: string;
          mp_payment_id?: string | null;
          pix_expira_em?: string | null;
          pix_qr_base64?: string | null;
          pix_qr_code?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contribuicoes_meta_pagamento_contribuicao_id_fkey";
            columns: ["contribuicao_id"];
            isOneToOne: true;
            referencedRelation: "contribuicoes_meta";
            referencedColumns: ["id"];
          },
        ];
      };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
      locais_baba: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          id: string;
          latitude: number;
          longitude: number;
          nome: string;
          raio_metros: number;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          latitude: number;
          longitude: number;
          nome: string;
          raio_metros?: number;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          latitude?: number;
          longitude?: number;
          nome?: string;
          raio_metros?: number;
        };
        Relationships: [];
      };
      mensalidades: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          id: string;
          mp_payment_id: string | null;
          mp_status: string | null;
          pago_em: string | null;
          pix_expira_em: string | null;
          pix_qr_base64: string | null;
          pix_qr_code: string | null;
          referencia: string;
          status: Database["public"]["Enums"]["status_pagamento"];
          usuario_id: string;
          valor: number;
          vencimento: string;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          mp_payment_id?: string | null;
          mp_status?: string | null;
          pago_em?: string | null;
          pix_expira_em?: string | null;
          pix_qr_base64?: string | null;
          pix_qr_code?: string | null;
          referencia: string;
          status?: Database["public"]["Enums"]["status_pagamento"];
          usuario_id: string;
          valor?: number;
          vencimento: string;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          id?: string;
          mp_payment_id?: string | null;
          mp_status?: string | null;
          pago_em?: string | null;
          pix_expira_em?: string | null;
          pix_qr_base64?: string | null;
          pix_qr_code?: string | null;
          referencia?: string;
          status?: Database["public"]["Enums"]["status_pagamento"];
          usuario_id?: string;
          valor?: number;
          vencimento?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mensalidades_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
<<<<<<< HEAD
        ]
      }
=======
          {
            foreignKeyName: "mensalidades_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "ranking_cartinhas";
            referencedColumns: ["id"];
          },
        ];
      };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
      notificacoes: {
        Row: {
          criado_em: string;
          id: string;
          lida: boolean;
          link: string | null;
          mensagem: string;
          tipo: string;
          titulo: string;
          usuario_id: string;
        };
        Insert: {
          criado_em?: string;
          id?: string;
          lida?: boolean;
          link?: string | null;
          mensagem?: string;
          tipo?: string;
          titulo: string;
          usuario_id: string;
        };
        Update: {
          criado_em?: string;
          id?: string;
          lida?: boolean;
          link?: string | null;
          mensagem?: string;
          tipo?: string;
          titulo?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      papeis_usuario: {
        Row: {
          criado_em: string;
          id: string;
          papel: Database["public"]["Enums"]["papel_usuario"];
          user_id: string;
        };
        Insert: {
          criado_em?: string;
          id?: string;
          papel: Database["public"]["Enums"]["papel_usuario"];
          user_id: string;
        };
        Update: {
          criado_em?: string;
          id?: string;
          papel?: Database["public"]["Enums"]["papel_usuario"];
          user_id?: string;
        };
        Relationships: [];
      };
      pedidos_convidado: {
        Row: {
          anfitriao_id: string;
          atualizado_em: string;
          baba_id: string;
          convidado_id: string;
          criado_em: string;
          decidido_por: string | null;
          id: string;
          presenca_id: string | null;
          solicitacao_id: string | null;
          status: Database["public"]["Enums"]["status_convidado"];
        };
        Insert: {
          anfitriao_id: string;
          atualizado_em?: string;
          baba_id: string;
          convidado_id: string;
          criado_em?: string;
          decidido_por?: string | null;
          id?: string;
          presenca_id?: string | null;
          solicitacao_id?: string | null;
          status?: Database["public"]["Enums"]["status_convidado"];
        };
        Update: {
          anfitriao_id?: string;
          atualizado_em?: string;
          baba_id?: string;
          convidado_id?: string;
          criado_em?: string;
          decidido_por?: string | null;
          id?: string;
          presenca_id?: string | null;
          solicitacao_id?: string | null;
          status?: Database["public"]["Enums"]["status_convidado"];
        };
        Relationships: [
          {
            foreignKeyName: "pedidos_convidado_baba_id_fkey";
            columns: ["baba_id"];
            isOneToOne: false;
            referencedRelation: "sessoes_baba";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pedidos_convidado_convidado_id_fkey";
            columns: ["convidado_id"];
            isOneToOne: false;
            referencedRelation: "convidados_cadastro";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pedidos_convidado_presenca_id_fkey";
            columns: ["presenca_id"];
            isOneToOne: false;
            referencedRelation: "presencas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pedidos_convidado_solicitacao_id_fkey";
            columns: ["solicitacao_id"];
            isOneToOne: false;
            referencedRelation: "solicitacoes_convidado";
            referencedColumns: ["id"];
          },
        ];
      };
      perfis: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          avatar_url: string | null;
          criado_em: string;
          email: string | null;
          email_confirmado: boolean;
          id: string;
          instagram: string | null;
          nivel_atual: number;
          nome: string;
          ovr: number;
          posicao: Database["public"]["Enums"]["posicao_jogador"];
          stat_defesa: number;
          stat_drible: number;
          stat_finalizacao: number;
          stat_fisico: number;
          stat_passe: number;
          stat_ritmo: number;
          status_pagamento: Database["public"]["Enums"]["status_pagamento"];
          telefone: string;
          tema_carta: string;
          time_coracao: Database["public"]["Enums"]["time_coracao"] | null;
          xp_atual: number;
        };
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          avatar_url?: string | null;
          criado_em?: string;
          email?: string | null;
          email_confirmado?: boolean;
          id: string;
          instagram?: string | null;
          nivel_atual?: number;
          nome: string;
          ovr?: number;
          posicao?: Database["public"]["Enums"]["posicao_jogador"];
          stat_defesa?: number;
          stat_drible?: number;
          stat_finalizacao?: number;
          stat_fisico?: number;
          stat_passe?: number;
          stat_ritmo?: number;
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"];
          telefone?: string;
          tema_carta?: string;
          time_coracao?: Database["public"]["Enums"]["time_coracao"] | null;
          xp_atual?: number;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          avatar_url?: string | null;
          criado_em?: string;
          email?: string | null;
          email_confirmado?: boolean;
          id?: string;
          instagram?: string | null;
          nivel_atual?: number;
          nome?: string;
          ovr?: number;
          posicao?: Database["public"]["Enums"]["posicao_jogador"];
          stat_defesa?: number;
          stat_drible?: number;
          stat_finalizacao?: number;
          stat_fisico?: number;
          stat_passe?: number;
          stat_ritmo?: number;
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"];
          telefone?: string;
          tema_carta?: string;
          time_coracao?: Database["public"]["Enums"]["time_coracao"] | null;
          xp_atual?: number;
        };
        Relationships: [];
      };
      perfis_publicos: {
        Row: {
<<<<<<< HEAD
          ativo: boolean
          avatar_url: string | null
          id: string
          nome: string
          ovr: number
          posicao: Database["public"]["Enums"]["posicao_jogador"]
          stat_defesa: number
          stat_drible: number
          stat_finalizacao: number
          stat_fisico: number
          stat_passe: number
          stat_ritmo: number
          tema_carta: string
          time_coracao: Database["public"]["Enums"]["time_coracao"] | null
        }
        Insert: {
          ativo?: boolean
          avatar_url?: string | null
          id: string
          nome: string
          ovr?: number
          posicao?: Database["public"]["Enums"]["posicao_jogador"]
          stat_defesa?: number
          stat_drible?: number
          stat_finalizacao?: number
          stat_fisico?: number
          stat_passe?: number
          stat_ritmo?: number
          tema_carta?: string
          time_coracao?: Database["public"]["Enums"]["time_coracao"] | null
        }
        Update: {
          ativo?: boolean
          avatar_url?: string | null
          id?: string
          nome?: string
          ovr?: number
          posicao?: Database["public"]["Enums"]["posicao_jogador"]
          stat_defesa?: number
          stat_drible?: number
          stat_finalizacao?: number
          stat_fisico?: number
          stat_passe?: number
          stat_ritmo?: number
          tema_carta?: string
          time_coracao?: Database["public"]["Enums"]["time_coracao"] | null
        }
=======
          ativo: boolean;
          avatar_url: string | null;
          id: string;
          instagram: string | null;
          nivel_atual: number;
          nome: string;
          posicao: Database["public"]["Enums"]["posicao_jogador"];
          time_coracao: Database["public"]["Enums"]["time_coracao"] | null;
          xp_atual: number;
        };
        Insert: {
          ativo?: boolean;
          avatar_url?: string | null;
          id: string;
          instagram?: string | null;
          nivel_atual?: number;
          nome: string;
          posicao?: Database["public"]["Enums"]["posicao_jogador"];
          time_coracao?: Database["public"]["Enums"]["time_coracao"] | null;
          xp_atual?: number;
        };
        Update: {
          ativo?: boolean;
          avatar_url?: string | null;
          id?: string;
          instagram?: string | null;
          nivel_atual?: number;
          nome?: string;
          posicao?: Database["public"]["Enums"]["posicao_jogador"];
          time_coracao?: Database["public"]["Enums"]["time_coracao"] | null;
          xp_atual?: number;
        };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
        Relationships: [
          {
            foreignKeyName: "perfis_publicos_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
<<<<<<< HEAD
        ]
      }
=======
          {
            foreignKeyName: "perfis_publicos_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "ranking_cartinhas";
            referencedColumns: ["id"];
          },
        ];
      };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
      presencas: {
        Row: {
          baba_id: string;
          chegou_em: string | null;
          compareceu: boolean | null;
          confirmado_em: string;
          convidado_cadastro_id: string | null;
          convidado_user_id: string | null;
          id: string;
          is_goleiro_fixo: boolean;
          mp_status: string | null;
          nome_convidado: string | null;
          ordem_chegada: number | null;
          status_convidado: Database["public"]["Enums"]["status_convidado"] | null;
          usuario_id: string;
          valor: number;
        };
        Insert: {
          baba_id: string;
          chegou_em?: string | null;
          compareceu?: boolean | null;
          confirmado_em?: string;
          convidado_cadastro_id?: string | null;
          convidado_user_id?: string | null;
          id?: string;
          is_goleiro_fixo?: boolean;
          mp_status?: string | null;
          nome_convidado?: string | null;
          ordem_chegada?: number | null;
          status_convidado?: Database["public"]["Enums"]["status_convidado"] | null;
          usuario_id: string;
          valor?: number;
        };
        Update: {
          baba_id?: string;
          chegou_em?: string | null;
          compareceu?: boolean | null;
          confirmado_em?: string;
          convidado_cadastro_id?: string | null;
          convidado_user_id?: string | null;
          id?: string;
          is_goleiro_fixo?: boolean;
          mp_status?: string | null;
          nome_convidado?: string | null;
          ordem_chegada?: number | null;
          status_convidado?: Database["public"]["Enums"]["status_convidado"] | null;
          usuario_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "presencas_baba_id_fkey";
            columns: ["baba_id"];
            isOneToOne: false;
            referencedRelation: "sessoes_baba";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "presencas_convidado_cadastro_id_fkey";
            columns: ["convidado_cadastro_id"];
            isOneToOne: false;
            referencedRelation: "convidados_cadastro";
            referencedColumns: ["id"];
          },
        ];
      };
      presencas_contato: {
        Row: {
          criado_em: string;
          presenca_id: string;
          telefone: string;
        };
        Insert: {
          criado_em?: string;
          presenca_id: string;
          telefone?: string;
        };
        Update: {
          criado_em?: string;
          presenca_id?: string;
          telefone?: string;
        };
        Relationships: [
          {
            foreignKeyName: "presencas_contato_presenca_id_fkey";
            columns: ["presenca_id"];
            isOneToOne: true;
            referencedRelation: "presencas";
            referencedColumns: ["id"];
          },
        ];
      };
      presencas_pagamento: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          mp_payment_id: string | null;
          pix_expira_em: string | null;
          pix_qr_base64: string | null;
          pix_qr_code: string | null;
          presenca_id: string;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          mp_payment_id?: string | null;
          pix_expira_em?: string | null;
          pix_qr_base64?: string | null;
          pix_qr_code?: string | null;
          presenca_id: string;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          mp_payment_id?: string | null;
          pix_expira_em?: string | null;
          pix_qr_base64?: string | null;
          pix_qr_code?: string | null;
          presenca_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "presencas_pagamento_presenca_id_fkey";
            columns: ["presenca_id"];
            isOneToOne: true;
            referencedRelation: "presencas";
            referencedColumns: ["id"];
          },
        ];
      };
      sessoes_baba: {
        Row: {
          abertura_lista: string | null;
          atualizado_em: string;
          criado_em: string;
          data_horario: string;
          esta_fechado: boolean;
          fechamento_lista: string | null;
          id: string;
          latitude: number;
          local: string;
          longitude: number;
          mostrar_lista_chegada: boolean;
          raio_metros: number;
          tipo: string;
        };
        Insert: {
          abertura_lista?: string | null;
          atualizado_em?: string;
          criado_em?: string;
          data_horario: string;
          esta_fechado?: boolean;
          fechamento_lista?: string | null;
          id?: string;
          latitude?: number;
          local: string;
          longitude?: number;
          mostrar_lista_chegada?: boolean;
          raio_metros?: number;
          tipo?: string;
        };
        Update: {
          abertura_lista?: string | null;
          atualizado_em?: string;
          criado_em?: string;
          data_horario?: string;
          esta_fechado?: boolean;
          fechamento_lista?: string | null;
          id?: string;
          latitude?: number;
          local?: string;
          longitude?: number;
          mostrar_lista_chegada?: boolean;
          raio_metros?: number;
          tipo?: string;
        };
        Relationships: [];
      };
      solicitacoes_associacao: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          decidido_por: string | null;
          id: string;
          observacao: string;
          status: Database["public"]["Enums"]["status_solicitacao_assoc"];
          usuario_id: string;
        };
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          decidido_por?: string | null;
          id?: string;
          observacao?: string;
          status?: Database["public"]["Enums"]["status_solicitacao_assoc"];
          usuario_id: string;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          decidido_por?: string | null;
          id?: string;
          observacao?: string;
          status?: Database["public"]["Enums"]["status_solicitacao_assoc"];
          usuario_id?: string;
        };
        Relationships: [];
      };
      solicitacoes_convidado: {
        Row: {
          anfitriao_id: string;
          atualizado_em: string;
          baba_id: string;
          criado_em: string;
          id: string;
          presenca_id: string | null;
          solicitante_id: string;
          status: Database["public"]["Enums"]["status_convidado"];
        };
        Insert: {
          anfitriao_id: string;
          atualizado_em?: string;
          baba_id: string;
          criado_em?: string;
          id?: string;
          presenca_id?: string | null;
          solicitante_id: string;
          status?: Database["public"]["Enums"]["status_convidado"];
        };
        Update: {
          anfitriao_id?: string;
          atualizado_em?: string;
          baba_id?: string;
          criado_em?: string;
          id?: string;
          presenca_id?: string | null;
          solicitante_id?: string;
          status?: Database["public"]["Enums"]["status_convidado"];
        };
        Relationships: [
          {
            foreignKeyName: "solicitacoes_convidado_baba_id_fkey";
            columns: ["baba_id"];
            isOneToOne: false;
            referencedRelation: "sessoes_baba";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "solicitacoes_convidado_presenca_id_fkey";
            columns: ["presenca_id"];
            isOneToOne: false;
            referencedRelation: "presencas";
            referencedColumns: ["id"];
          },
        ];
      };
      suspensoes: {
        Row: {
          baba_bloqueado_id: string | null;
          baba_origem_id: string | null;
          criado_em: string;
          id: string;
          motivo: string;
          origem: string;
          usuario_id: string;
        };
        Insert: {
          baba_bloqueado_id?: string | null;
          baba_origem_id?: string | null;
          criado_em?: string;
          id?: string;
          motivo?: string;
          origem?: string;
          usuario_id: string;
        };
        Update: {
          baba_bloqueado_id?: string | null;
          baba_origem_id?: string | null;
          criado_em?: string;
          id?: string;
          motivo?: string;
          origem?: string;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suspensoes_baba_bloqueado_id_fkey";
            columns: ["baba_bloqueado_id"];
            isOneToOne: false;
            referencedRelation: "sessoes_baba";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suspensoes_baba_origem_id_fkey";
            columns: ["baba_origem_id"];
            isOneToOne: false;
            referencedRelation: "sessoes_baba";
            referencedColumns: ["id"];
          },
        ];
      };
      times_baba: {
        Row: {
          atualizado_em: string;
          baba_id: string;
          criado_em: string;
          id: string;
          nome: string;
          resultado: Database["public"]["Enums"]["resultado_time"] | null;
        };
        Insert: {
          atualizado_em?: string;
          baba_id: string;
          criado_em?: string;
          id?: string;
          nome: string;
          resultado?: Database["public"]["Enums"]["resultado_time"] | null;
        };
        Update: {
          atualizado_em?: string;
          baba_id?: string;
          criado_em?: string;
          id?: string;
          nome?: string;
          resultado?: Database["public"]["Enums"]["resultado_time"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "times_baba_baba_id_fkey";
            columns: ["baba_id"];
            isOneToOne: false;
            referencedRelation: "sessoes_baba";
            referencedColumns: ["id"];
          },
        ];
      };
      times_jogadores: {
        Row: {
          criado_em: string;
          id: string;
          nome_convidado: string | null;
          posicao: Database["public"]["Enums"]["posicao_jogador"];
          time_id: string;
          usuario_id: string | null;
        };
        Insert: {
          criado_em?: string;
          id?: string;
          nome_convidado?: string | null;
          posicao?: Database["public"]["Enums"]["posicao_jogador"];
          time_id: string;
          usuario_id?: string | null;
        };
        Update: {
          criado_em?: string;
          id?: string;
          nome_convidado?: string | null;
          posicao?: Database["public"]["Enums"]["posicao_jogador"];
          time_id?: string;
          usuario_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "times_jogadores_time_id_fkey";
            columns: ["time_id"];
            isOneToOne: false;
            referencedRelation: "times_baba";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "times_jogadores_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
<<<<<<< HEAD
        ]
      }
=======
          {
            foreignKeyName: "times_jogadores_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "ranking_cartinhas";
            referencedColumns: ["id"];
          },
        ];
      };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
      usuario_conquistas: {
        Row: {
          conquista_id: string;
          desbloqueada_em: string;
          em_destaque: boolean;
          id: string;
          ordem_destaque: number | null;
          usuario_id: string;
        };
        Insert: {
          conquista_id: string;
          desbloqueada_em?: string;
          em_destaque?: boolean;
          id?: string;
          ordem_destaque?: number | null;
          usuario_id: string;
        };
        Update: {
          conquista_id?: string;
          desbloqueada_em?: string;
          em_destaque?: boolean;
          id?: string;
          ordem_destaque?: number | null;
          usuario_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usuario_conquistas_conquista_id_fkey";
            columns: ["conquista_id"];
            isOneToOne: false;
            referencedRelation: "conquistas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "usuario_conquistas_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "perfis";
            referencedColumns: ["id"];
          },
<<<<<<< HEAD
        ]
      }
=======
          {
            foreignKeyName: "usuario_conquistas_usuario_id_fkey";
            columns: ["usuario_id"];
            isOneToOne: false;
            referencedRelation: "ranking_cartinhas";
            referencedColumns: ["id"];
          },
        ];
      };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
      verificacoes_email: {
        Row: {
          criado_em: string;
          email: string;
          expira_em: string;
          id: string;
          tipo: string;
          token_hash: string;
          usado_em: string | null;
          usuario_id: string;
        };
        Insert: {
          criado_em?: string;
          email: string;
          expira_em: string;
          id?: string;
          tipo?: string;
          token_hash: string;
          usado_em?: string | null;
          usuario_id: string;
        };
        Update: {
          criado_em?: string;
          email?: string;
          expira_em?: string;
          id?: string;
          tipo?: string;
          token_hash?: string;
          usado_em?: string | null;
          usuario_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      ranking_cartinhas: {
        Row: {
          avatar_url: string | null;
          id: string | null;
          instagram: string | null;
          nivel_atual: number | null;
          nome: string | null;
          ovr: number | null;
          posicao: Database["public"]["Enums"]["posicao_jogador"] | null;
          stat_defesa: number | null;
          stat_drible: number | null;
          stat_finalizacao: number | null;
          stat_fisico: number | null;
          stat_passe: number | null;
          stat_ritmo: number | null;
          tema_carta: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          id?: string | null;
          instagram?: string | null;
          nivel_atual?: number | null;
          nome?: string | null;
          ovr?: number | null;
          posicao?: Database["public"]["Enums"]["posicao_jogador"] | null;
          stat_defesa?: number | null;
          stat_drible?: number | null;
          stat_finalizacao?: number | null;
          stat_fisico?: number | null;
          stat_passe?: number | null;
          stat_ritmo?: number | null;
          tema_carta?: string | null;
        };
        Update: {
<<<<<<< HEAD
          avatar_url?: string | null
          id?: string | null
          nome?: string | null
          ovr?: number | null
          posicao?: Database["public"]["Enums"]["posicao_jogador"] | null
          stat_defesa?: number | null
          stat_drible?: number | null
          stat_finalizacao?: number | null
          stat_fisico?: number | null
          stat_passe?: number | null
          stat_ritmo?: number | null
          tema_carta?: string | null
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
=======
          avatar_url?: string | null;
          id?: string | null;
          instagram?: string | null;
          nivel_atual?: number | null;
          nome?: string | null;
          ovr?: number | null;
          posicao?: Database["public"]["Enums"]["posicao_jogador"] | null;
          stat_defesa?: number | null;
          stat_drible?: number | null;
          stat_finalizacao?: number | null;
          stat_fisico?: number | null;
          stat_passe?: number | null;
          stat_ritmo?: number | null;
          tema_carta?: string | null;
        };
        Relationships: [];
      };
      total_conquistas_usuario: {
        Row: {
          total: number | null;
          usuario_id: string | null;
        };
        Relationships: [];
      };
      total_conquistadores: {
        Row: {
          conquista_id: string | null;
          total: number | null;
        };
        Relationships: [];
      };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
      ranking_mensal: {
        Row: {
          assistencias: number | null;
          cartoes_amarelos: number | null;
          cartoes_azuis: number | null;
          cartoes_vermelhos: number | null;
          derrotas: number | null;
          empates: number | null;
          gols: number | null;
          mes: string | null;
          nome: string | null;
          penaltis_defendidos: number | null;
          posicao: Database["public"]["Enums"]["posicao_jogador"] | null;
          usuario_id: string | null;
          vitorias: number | null;
        };
        Relationships: [];
      };
    };
    Functions: {
<<<<<<< HEAD
      admin_concede_conquista: {
        Args: { _conquista: string; _usuario: string }
        Returns: string
      }
      admin_remove_conquista: {
        Args: { _conquista: string; _usuario: string }
        Returns: undefined
      }
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
      concede_conquista_historica: {
        Args: {
          p_codigo: string
          p_cor?: string
          p_descricao: string
          p_icone?: string
          p_metadata?: Json
          p_titulo: string
          p_usuario: string
        }
        Returns: string
      }
      concede_xp: {
        Args: { quantidade: number; usuario: string }
        Returns: number
      }
      config_int: { Args: { _chave: string; _padrao: number }; Returns: number }
      conquistas_do_usuario: {
        Args: { _usuario: string }
        Returns: {
          conquista_id: string
          desbloqueada_em: string
        }[]
      }
      cria_evento_feed: {
        Args: {
          p_chave?: string
          p_conquista: string
          p_descricao?: string
          p_metadata?: Json
          p_tipo: string
          p_titulo: string
          p_usuario: string
        }
        Returns: string
      }
=======
      alternar_like_feed: {
        Args: { p_feed_evento_id: string };
        Returns: boolean;
      };
      aplica_suspensao: {
        Args: {
          _motivo: string;
          _origem: string;
          _origem_baba: string;
          _quantidade: number;
          _usuario_id: string;
        };
        Returns: number;
      };
      atualizar_meta_admin: {
        Args: {
          p_categoria?: string;
          p_descricao?: string;
          p_imagem_url?: string;
          p_meta_id: string;
          p_prazo?: string;
          p_status?: string;
          p_titulo?: string;
          p_valor_alvo?: number;
        };
        Returns: undefined;
      };
      babas_pagos_convidado: { Args: { _user_id: string }; Returns: number };
      calcula_cartinha: { Args: { usuario: string }; Returns: undefined };
      concede_conquista_historica: {
        Args: {
          p_codigo: string;
          p_cor?: string;
          p_descricao: string;
          p_icone?: string;
          p_metadata?: Json;
          p_titulo: string;
          p_usuario: string;
        };
        Returns: string;
      };
      concede_xp: {
        Args: { quantidade: number; usuario: string };
        Returns: number;
      };
      config_int: { Args: { _chave: string; _padrao: number }; Returns: number };
      confirmar_contribuicao_meta: {
        Args: { p_contribuicao_id: string };
        Returns: undefined;
      };
      cria_evento_feed: {
        Args: {
          p_chave?: string;
          p_conquista?: string;
          p_descricao?: string;
          p_metadata?: Json;
          p_titulo: string;
          p_tipo: string;
          p_usuario: string;
        };
        Returns: string;
      };
      criar_meta_admin: {
        Args: {
          p_categoria?: string;
          p_descricao?: string;
          p_imagem_url?: string;
          p_prazo?: string;
          p_titulo: string;
          p_valor_alvo: number;
        };
        Returns: string;
      };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
      criar_pedido_convidado: {
        Args: {
          _baba_id: string;
          _convidado_id?: string;
          _nome: string;
          _telefone: string;
        };
        Returns: {
          convidado_id: string;
          pedido_id: string;
          status: Database["public"]["Enums"]["status_convidado"];
        }[];
      };
      decidir_pedido_convidado: {
        Args: { _aprovar: boolean; _pedido_id: string };
        Returns: undefined;
      };
      desbloqueia_conquista: {
        Args: { conquista: string; usuario: string };
        Returns: undefined;
      };
      garante_mensalidade: {
        Args: { _referencia: string; _usuario_id: string };
        Returns: string;
      };
      garante_mensalidades_mes: { Args: never; Returns: undefined };
      marcar_chegada: {
<<<<<<< HEAD
        Args: { _lat: number; _lng: number; _presenca_id: string }
        Returns: number
      }
      modera_evento_feed: {
        Args: { p_evento_id: string; p_visibilidade: string }
        Returns: undefined
      }
      nivel_para_xp: { Args: { xp: number }; Returns: number }
=======
        Args: { _lat: number; _lng: number; _presenca_id: string };
        Returns: number;
      };
      modera_evento_feed: {
        Args: { p_evento_id: string; p_visibilidade: string };
        Returns: undefined;
      };
      nivel_para_xp: { Args: { xp: number }; Returns: number };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
      notifica: {
        Args: {
          _link?: string;
          _mensagem: string;
          _tipo: string;
          _titulo: string;
          _usuario_id: string;
        };
        Returns: undefined;
      };
      notifica_admins: {
        Args: {
          _link?: string;
          _mensagem: string;
          _tipo: string;
          _titulo: string;
        };
        Returns: undefined;
      };
      reajusta_mensalidades_pendentes: { Args: never; Returns: undefined };
      solicita_convite: {
<<<<<<< HEAD
        Args: { _anfitriao_id: string; _baba_id: string }
        Returns: string
      }
      status_pagamento_presencas: {
        Args: { _baba_id: string }
        Returns: {
          mp_status: string
          presenca_id: string
        }[]
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
      verifica_evento_ranking: {
        Args: { p_usuario: string }
        Returns: undefined
      }
      xp_necessaria_para_nivel: { Args: { nivel: number }; Returns: number }
    }
=======
        Args: { _anfitriao_id: string; _baba_id: string };
        Returns: string;
      };
      telefone_convidado: { Args: { _convidado_id: string }; Returns: string };
      tem_papel: {
        Args: {
          _papel: Database["public"]["Enums"]["papel_usuario"];
          _user_id: string;
        };
        Returns: boolean;
      };
      total_associados_ativos: { Args: never; Returns: number };
      valor_mensalidade: { Args: never; Returns: number };
      verifica_conquistas: { Args: { usuario: string }; Returns: undefined };
      verifica_evento_ranking: { Args: { p_usuario: string }; Returns: undefined };
      xp_necessaria_para_nivel: { Args: { nivel: number }; Returns: number };
    };
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
    Enums: {
      papel_usuario: "administrador" | "associado" | "convidado";
      posicao_jogador: "goleiro" | "linha";
      resultado_time: "vitoria" | "derrota" | "empate";
      status_convidado: "pendente" | "aprovado" | "rejeitado";
      status_pagamento: "pago" | "pendente";
      status_solicitacao_assoc: "pendente" | "aprovado" | "rejeitado";
      time_coracao: "bahia" | "vitoria";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
<<<<<<< HEAD
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
=======
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
<<<<<<< HEAD
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
=======
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
<<<<<<< HEAD
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
=======
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
<<<<<<< HEAD
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
=======
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
<<<<<<< HEAD
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
=======
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
>>>>>>> d688dda (Rede social, agenda e metas: perfil publico, Instagram, likes, agenda da Arena e metas coletivas)
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

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
} as const;
