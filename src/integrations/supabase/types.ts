export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      accounts: {
        Row: {
          archived: boolean;
          balance_cents: number;
          connection_id: string | null;
          created_at: string;
          credit_due_day: number | null;
          credit_limit_cents: number | null;
          currency: Database["public"]["Enums"]["currency_code"];
          id: string;
          kind: Database["public"]["Enums"]["account_kind"];
          name: string;
          provider_account_id: string | null;
          source: Database["public"]["Enums"]["tx_source"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          archived?: boolean;
          balance_cents?: number;
          connection_id?: string | null;
          created_at?: string;
          credit_due_day?: number | null;
          credit_limit_cents?: number | null;
          currency: Database["public"]["Enums"]["currency_code"];
          id?: string;
          kind: Database["public"]["Enums"]["account_kind"];
          name: string;
          provider_account_id?: string | null;
          source?: Database["public"]["Enums"]["tx_source"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          archived?: boolean;
          balance_cents?: number;
          connection_id?: string | null;
          created_at?: string;
          credit_due_day?: number | null;
          credit_limit_cents?: number | null;
          currency?: Database["public"]["Enums"]["currency_code"];
          id?: string;
          kind?: Database["public"]["Enums"]["account_kind"];
          name?: string;
          provider_account_id?: string | null;
          source?: Database["public"]["Enums"]["tx_source"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "provider_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          color: string | null;
          created_at: string;
          essential: boolean;
          id: string;
          kind: Database["public"]["Enums"]["category_kind"];
          monthly_budget_cents: number | null;
          name: string;
          parent_id: string | null;
          sort_order: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          essential?: boolean;
          id?: string;
          kind?: Database["public"]["Enums"]["category_kind"];
          monthly_budget_cents?: number | null;
          name: string;
          parent_id?: string | null;
          sort_order?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          essential?: boolean;
          id?: string;
          kind?: Database["public"]["Enums"]["category_kind"];
          monthly_budget_cents?: number | null;
          name?: string;
          parent_id?: string | null;
          sort_order?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      categorization_rules: {
        Row: {
          category_id: string | null;
          created_at: string;
          direction: string;
          id: string;
          pattern: string;
          set_type: Database["public"]["Enums"]["tx_domain_type"] | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_id?: string | null;
          created_at?: string;
          direction?: string;
          id?: string;
          pattern: string;
          set_type?: Database["public"]["Enums"]["tx_domain_type"] | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_id?: string | null;
          created_at?: string;
          direction?: string;
          id?: string;
          pattern?: string;
          set_type?: Database["public"]["Enums"]["tx_domain_type"] | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categorization_rules_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      category_mappings: {
        Row: {
          category_id: string;
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["category_kind"];
          provider_category_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["category_kind"];
          provider_category_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["category_kind"];
          provider_category_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "category_mappings_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      exchange_rates: {
        Row: {
          base_currency: Database["public"]["Enums"]["currency_code"];
          created_at: string;
          effective_on: string;
          id: string;
          quote_currency: Database["public"]["Enums"]["currency_code"];
          rate: number;
          source: string;
        };
        Insert: {
          base_currency: Database["public"]["Enums"]["currency_code"];
          created_at?: string;
          effective_on: string;
          id?: string;
          quote_currency: Database["public"]["Enums"]["currency_code"];
          rate: number;
          source?: string;
        };
        Update: {
          base_currency?: Database["public"]["Enums"]["currency_code"];
          created_at?: string;
          effective_on?: string;
          id?: string;
          quote_currency?: Database["public"]["Enums"]["currency_code"];
          rate?: number;
          source?: string;
        };
        Relationships: [];
      };
      provider_connections: {
        Row: {
          connector_id: number | null;
          created_at: string;
          id: string;
          institution_name: string;
          last_error: string | null;
          last_synced_at: string | null;
          provider: Database["public"]["Enums"]["of_provider"];
          provider_item_id: string;
          status: Database["public"]["Enums"]["connection_status"];
          sync_cursor: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          connector_id?: number | null;
          created_at?: string;
          id?: string;
          institution_name: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          provider?: Database["public"]["Enums"]["of_provider"];
          provider_item_id: string;
          status?: Database["public"]["Enums"]["connection_status"];
          sync_cursor?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          connector_id?: number | null;
          created_at?: string;
          id?: string;
          institution_name?: string;
          last_error?: string | null;
          last_synced_at?: string | null;
          provider?: Database["public"]["Enums"]["of_provider"];
          provider_item_id?: string;
          status?: Database["public"]["Enums"]["connection_status"];
          sync_cursor?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      sync_runs: {
        Row: {
          accounts_synced: number;
          connection_id: string;
          created_at: string;
          cursor_after: string | null;
          cursor_before: string | null;
          error: string | null;
          finished_at: string | null;
          id: string;
          range_from: string | null;
          range_to: string | null;
          started_at: string;
          status: string;
          transactions_upserted: number;
          user_id: string;
        };
        Insert: {
          accounts_synced?: number;
          connection_id: string;
          created_at?: string;
          cursor_after?: string | null;
          cursor_before?: string | null;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          range_from?: string | null;
          range_to?: string | null;
          started_at?: string;
          status?: string;
          transactions_upserted?: number;
          user_id: string;
        };
        Update: {
          accounts_synced?: number;
          connection_id?: string;
          created_at?: string;
          cursor_after?: string | null;
          cursor_before?: string | null;
          error?: string | null;
          finished_at?: string | null;
          id?: string;
          range_from?: string | null;
          range_to?: string | null;
          started_at?: string;
          status?: string;
          transactions_upserted?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sync_runs_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "provider_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          account_id: string;
          amount_cents: number;
          category_id: string | null;
          created_at: string;
          currency: Database["public"]["Enums"]["currency_code"];
          description: string;
          hidden: boolean;
          id: string;
          notes: string | null;
          occurred_on: string;
          provider_category_id: string | null;
          provider_operation_type: string | null;
          provider_tx_id: string | null;
          source: Database["public"]["Enums"]["tx_source"];
          status: Database["public"]["Enums"]["tx_status"];
          type: Database["public"]["Enums"]["tx_domain_type"];
          updated_at: string;
          user_id: string;
          user_overridden: boolean;
        };
        Insert: {
          account_id: string;
          amount_cents: number;
          category_id?: string | null;
          created_at?: string;
          currency: Database["public"]["Enums"]["currency_code"];
          description: string;
          hidden?: boolean;
          id?: string;
          notes?: string | null;
          occurred_on: string;
          provider_category_id?: string | null;
          provider_operation_type?: string | null;
          provider_tx_id?: string | null;
          source?: Database["public"]["Enums"]["tx_source"];
          status?: Database["public"]["Enums"]["tx_status"];
          type: Database["public"]["Enums"]["tx_domain_type"];
          updated_at?: string;
          user_id: string;
          user_overridden?: boolean;
        };
        Update: {
          account_id?: string;
          amount_cents?: number;
          category_id?: string | null;
          created_at?: string;
          currency?: Database["public"]["Enums"]["currency_code"];
          description?: string;
          hidden?: boolean;
          id?: string;
          notes?: string | null;
          occurred_on?: string;
          provider_category_id?: string | null;
          provider_operation_type?: string | null;
          provider_tx_id?: string | null;
          source?: Database["public"]["Enums"]["tx_source"];
          status?: Database["public"]["Enums"]["tx_status"];
          type?: Database["public"]["Enums"]["tx_domain_type"];
          updated_at?: string;
          user_id?: string;
          user_overridden?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_transaction_patches: { Args: { patches: Json }; Returns: number };
    };
    Enums: {
      account_kind: "CHECKING" | "CREDIT_CARD" | "INVESTMENT" | "CASH" | "OTHER";
      category_kind: "INCOME" | "EXPENSE";
      connection_status: "ACTIVE" | "LOGIN_ERROR" | "OUTDATED" | "DISCONNECTED";
      currency_code: "BRL" | "CAD" | "USD" | "EUR" | "ARS";
      of_provider: "PLUGGY";
      tx_domain_type:
        "EXPENSE" | "INCOME" | "TRANSFER" | "INVESTMENT_CONTRIBUTION" | "CARD_PAYMENT";
      tx_source: "IMPORT" | "MANUAL";
      tx_status: "POSTED" | "PENDING";
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_kind: ["CHECKING", "CREDIT_CARD", "INVESTMENT", "CASH", "OTHER"],
      category_kind: ["INCOME", "EXPENSE"],
      connection_status: ["ACTIVE", "LOGIN_ERROR", "OUTDATED", "DISCONNECTED"],
      currency_code: ["BRL", "CAD", "USD", "EUR", "ARS"],
      of_provider: ["PLUGGY"],
      tx_domain_type: ["EXPENSE", "INCOME", "TRANSFER", "INVESTMENT_CONTRIBUTION", "CARD_PAYMENT"],
      tx_source: ["IMPORT", "MANUAL"],
      tx_status: ["POSTED", "PENDING"],
    },
  },
} as const;
