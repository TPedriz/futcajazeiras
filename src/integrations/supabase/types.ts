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
      presencas: {
        Row: {
          baba_id: string
          confirmado_em: string
          id: string
          nome_convidado: string | null
          status_convidado:
            | Database["public"]["Enums"]["status_convidado"]
            | null
          usuario_id: string
        }
        Insert: {
          baba_id: string
          confirmado_em?: string
          id?: string
          nome_convidado?: string | null
          status_convidado?:
            | Database["public"]["Enums"]["status_convidado"]
            | null
          usuario_id: string
        }
        Update: {
          baba_id?: string
          confirmado_em?: string
          id?: string
          nome_convidado?: string | null
          status_convidado?:
            | Database["public"]["Enums"]["status_convidado"]
            | null
          usuario_id?: string
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
    }
    Views: {
      perfis_publicos: {
        Row: {
          id: string | null
          nome: string | null
          posicao: Database["public"]["Enums"]["posicao_jogador"] | null
        }
        Insert: {
          id?: string | null
          nome?: string | null
          posicao?: Database["public"]["Enums"]["posicao_jogador"] | null
        }
        Update: {
          id?: string | null
          nome?: string | null
          posicao?: Database["public"]["Enums"]["posicao_jogador"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      tem_papel: {
        Args: {
          _papel: Database["public"]["Enums"]["papel_usuario"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      papel_usuario: "administrador" | "associado"
      posicao_jogador: "goleiro" | "linha"
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
      papel_usuario: ["administrador", "associado"],
      posicao_jogador: ["goleiro", "linha"],
      status_convidado: ["pendente", "aprovado", "rejeitado"],
      status_pagamento: ["pago", "pendente"],
    },
  },
} as const
