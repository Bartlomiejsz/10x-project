export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
    graphql_public: {
        Tables: Record<never, never>;
        Views: Record<never, never>;
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
        Enums: Record<never, never>;
        CompositeTypes: Record<never, never>;
    };
    public: {
        Tables: {
            budgets: {
                Row: {
                    amount: number;
                    created_at: string;
                    month_date: string;
                    type_id: number;
                    updated_at: string;
                };
                Insert: {
                    amount: number;
                    created_at?: string;
                    month_date: string;
                    type_id: number;
                    updated_at?: string;
                };
                Update: {
                    amount?: number;
                    created_at?: string;
                    month_date?: string;
                    type_id?: number;
                    updated_at?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'budgets_type_id_fkey';
                        columns: ['type_id'];
                        isOneToOne: false;
                        referencedRelation: 'transaction_types';
                        referencedColumns: ['id'];
                    },
                ];
            };
            transaction_types: {
                Row: {
                    code: string;
                    created_at: string;
                    id: number;
                    name: string;
                    position: number;
                    updated_at: string;
                };
                Insert: {
                    code: string;
                    created_at?: string;
                    id?: number;
                    name: string;
                    position: number;
                    updated_at?: string;
                };
                Update: {
                    code?: string;
                    created_at?: string;
                    id?: number;
                    name?: string;
                    position?: number;
                    updated_at?: string;
                };
                Relationships: [];
            };
            transactions: {
                Row: {
                    ai_confidence: number | null;
                    ai_status: Database['public']['Enums']['ai_status'] | null;
                    amount: number;
                    created_at: string;
                    date: string;
                    description: string;
                    id: string;
                    import_hash: string | null;
                    is_manual_override: boolean;
                    type_id: number;
                    updated_at: string;
                    user_id: string;
                };
                Insert: {
                    ai_confidence?: number | null;
                    ai_status?: Database['public']['Enums']['ai_status'] | null;
                    amount: number;
                    created_at?: string;
                    date: string;
                    description: string;
                    id?: string;
                    import_hash?: string | null;
                    is_manual_override?: boolean;
                    type_id: number;
                    updated_at?: string;
                    user_id: string;
                };
                Update: {
                    ai_confidence?: number | null;
                    ai_status?: Database['public']['Enums']['ai_status'] | null;
                    amount?: number;
                    created_at?: string;
                    date?: string;
                    description?: string;
                    id?: string;
                    import_hash?: string | null;
                    is_manual_override?: boolean;
                    type_id?: number;
                    updated_at?: string;
                    user_id?: string;
                };
                Relationships: [
                    {
                        foreignKeyName: 'transactions_type_id_fkey';
                        columns: ['type_id'];
                        isOneToOne: false;
                        referencedRelation: 'transaction_types';
                        referencedColumns: ['id'];
                    },
                ];
            };
        };
        Views: Record<never, never>;
        Functions: Record<never, never>;
        Enums: {
            ai_status: 'success' | 'fallback' | 'error';
        };
        CompositeTypes: Record<never, never>;
    };
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
    DefaultSchemaTableNameOrOptions extends
        | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
        | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
              DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
          DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
          Row: infer R;
      }
        ? R
        : never
    : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
      ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
            Row: infer R;
        }
          ? R
          : never
      : never;

export type TablesInsert<
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Insert: infer I;
      }
        ? I
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Insert: infer I;
        }
          ? I
          : never
      : never;

export type TablesUpdate<
    DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
    TableName extends DefaultSchemaTableNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
        : never = never,
> = DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
          Update: infer U;
      }
        ? U
        : never
    : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
      ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
            Update: infer U;
        }
          ? U
          : never
      : never;

export type Enums<
    DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
    EnumName extends DefaultSchemaEnumNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
        : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
    : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
      ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
      : never;

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
        | keyof DefaultSchema['CompositeTypes']
        | { schema: keyof DatabaseWithoutInternals },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof DatabaseWithoutInternals;
    }
        ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
        : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
}
    ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
      ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
      : never;

export const Constants = {
    graphql_public: {
        Enums: {},
    },
    public: {
        Enums: {
            ai_status: ['success', 'fallback', 'error'],
        },
    },
} as const;
