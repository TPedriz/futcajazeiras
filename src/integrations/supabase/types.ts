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
      estatisticas_baba: {
        Row: {
          atualizado_em: string
          baba_id: string
          cartoes_amarelos: number
          cartoes_azuis: number
          cartoes_vermelhos: number
          criado_em: string
          gols: number
          id: string
          usuario_id: string
        }
        Insert: {
          atualizado_em?: string
          baba_id: string
          cartoes_amarelos?: number
          cartoes_azuis?: number
          cartoes_vermelhos?: number
          criado_em?: string
          gols?: number
          id?: string
          usuario_id: string
        }
        Update: {
          atualizado_em?: string
          baba_id?: string
          cartoes_amarelos?: number
          cartoes_azuis?: number
          cartoes_vermelhos?: number
          criado_em?: string
          gols?: number
          id?: string
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
          mensagem: string
          tipo: string
          titulo: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          lida?: boolean
          mensagem?: string
          tipo?: string
          titulo: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          lida?: boolean
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
      perfis: {
        Row: {
          atualizado_em: string
          criado_em: string
          email: string
          id: string
          nome: string
          posicao: Database["public"]["Enums"]["posicao_jogador"]
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          telefone: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          email: string
          id: string
          nome: string
          posicao?: Database["public"]["Enums"]["posicao_jogador"]
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          telefone?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          email?: string
          id?: string
          nome?: string
          posicao?: Database["public"]["Enums"]["posicao_jogador"]
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          telefone?: string
        }
        Relationships: []
      }
      perfis_publicos: {
        Row: {
          id: string
          nome: string
          posicao: Database["public"]["Enums"]["posicao_jogador"]
        }
        Insert: {
          id: string
          nome: string
          posicao?: Database["public"]["Enums"]["posicao_jogador"]
        }
        Update: {
          id?: string
          nome?: string
          posicao?: Database["public"]["Enums"]["posicao_jogador"]
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
          confirmado_em: string
          id: string
          mp_payment_id: string | null
          mp_status: string | null
          nome_convidado: string | null
          pix_expira_em: string | null
          pix_qr_base64: string | null
          pix_qr_code: string | null
          status_convidado:
            | Database["public"]["Enums"]["status_convidado"]
            | null
          usuario_id: string
          valor: number
        }
        Insert: {
          baba_id: string
          confirmado_em?: string
          id?: string
          mp_payment_id?: string | null
          mp_status?: string | null
          nome_convidado?: string | null
          pix_expira_em?: string | null
          pix_qr_base64?: string | null
          pix_qr_code?: string | null
          status_convidado?:
            | Database["public"]["Enums"]["status_convidado"]
            | null
          usuario_id: string
          valor?: number
        }
        Update: {
          baba_id?: string
          confirmado_em?: string
          id?: string
          mp_payment_id?: string | null
          mp_status?: string | null
          nome_convidado?: string | null
          pix_expira_em?: string | null
          pix_qr_base64?: string | null
          pix_qr_code?: string | null
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
        ]
      }
      sessoes_baba: {
        Row: {
          atualizado_em: string
          criado_em: string
          data_horario: string
          esta_fechado: boolean
          fechamento_lista: string
          id: string
          local: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          data_horario: string
          esta_fechado?: boolean
          fechamento_lista: string
          id?: string
          local: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          data_horario?: string
          esta_fechado?: boolean
          fechamento_lista?: string
          id?: string
          local?: string
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
          usuario_id: string
        }
        Insert: {
          baba_bloqueado_id?: string | null
          baba_origem_id?: string | null
          criado_em?: string
          id?: string
          motivo?: string
          usuario_id: string
        }
        Update: {
          baba_bloqueado_id?: string | null
          baba_origem_id?: string | null
          criado_em?: string
          id?: string
          motivo?: string
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
    }
    Views: {
      ranking_mensal: {
        Row: {
          cartoes_amarelos: number | null
          cartoes_azuis: number | null
          cartoes_vermelhos: number | null
          derrotas: number | null
          empates: number | null
          gols: number | null
          mes: string | null
          nome: string | null
          posicao: Database["public"]["Enums"]["posicao_jogador"] | null
          usuario_id: string | null
          vitorias: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      garante_mensalidades_mes: { Args: never; Returns: undefined }
      notifica: {
        Args: {
          _mensagem: string
          _tipo: string
          _titulo: string
          _usuario_id: string
        }
        Returns: undefined
      }
      tem_papel: {
        Args: {
          _papel: Database["public"]["Enums"]["papel_usuario"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      papel_usuario: "administrador" | "associado" | "convidado"
      posicao_jogador: "goleiro" | "linha"
      resultado_time: "vitoria" | "derrota" | "empate"
      status_convidado: "pendente" | "aprovado" | "rejeitado"
      status_pagamento: "pago" | "pendente"
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
    },
  },
} as const
