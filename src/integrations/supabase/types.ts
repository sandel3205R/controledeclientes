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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      account_categories: {
        Row: {
          color: string | null
          created_at: string
          icon: string | null
          id: string
          name: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_messages: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          message: string
          priority: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message: string
          priority?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          message?: string
          priority?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      app_types: {
        Row: {
          created_at: string
          id: string
          name: string
          seller_id: string
          updated_at: string
          uses_email: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          seller_id: string
          updated_at?: string
          uses_email?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          seller_id?: string
          updated_at?: string
          uses_email?: boolean
        }
        Relationships: []
      }
      bills_to_pay: {
        Row: {
          amount: number
          created_at: string
          description: string
          due_date: string
          id: string
          is_paid: boolean | null
          notes: string | null
          paid_at: string | null
          recipient_name: string
          recipient_pix: string | null
          recipient_telegram: string | null
          recipient_whatsapp: string | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          due_date: string
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          paid_at?: string | null
          recipient_name: string
          recipient_pix?: string | null
          recipient_telegram?: string | null
          recipient_whatsapp?: string | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          is_paid?: boolean | null
          notes?: string | null
          paid_at?: string | null
          recipient_name?: string
          recipient_pix?: string | null
          recipient_telegram?: string | null
          recipient_whatsapp?: string | null
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      client_apps: {
        Row: {
          activation_date: string
          app_price: number | null
          app_type: string
          client_id: string
          created_at: string
          device_id: string | null
          email: string | null
          expiration_date: string
          id: string
          mac_address: string | null
          notes: string | null
          password: string | null
          seller_id: string
          updated_at: string
        }
        Insert: {
          activation_date?: string
          app_price?: number | null
          app_type: string
          client_id: string
          created_at?: string
          device_id?: string | null
          email?: string | null
          expiration_date: string
          id?: string
          mac_address?: string | null
          notes?: string | null
          password?: string | null
          seller_id: string
          updated_at?: string
        }
        Update: {
          activation_date?: string
          app_price?: number | null
          app_type?: string
          client_id?: string
          created_at?: string
          device_id?: string | null
          email?: string | null
          expiration_date?: string
          id?: string
          mac_address?: string | null
          notes?: string | null
          password?: string | null
          seller_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_apps_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_message_tracking: {
        Row: {
          client_id: string
          created_at: string
          expiration_date: string
          id: string
          messaged_at: string
          seller_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          expiration_date: string
          id?: string
          messaged_at?: string
          seller_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          expiration_date?: string
          id?: string
          messaged_at?: string
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_message_tracking_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          account_type: string | null
          app_name: string | null
          created_at: string | null
          device: string | null
          email: string | null
          expiration_date: string
          id: string
          is_annual_paid: boolean | null
          is_paid: boolean | null
          login: string | null
          login2: string | null
          login3: string | null
          login4: string | null
          login5: string | null
          mac_address: string | null
          name: string
          notes: string | null
          password: string | null
          password2: string | null
          password3: string | null
          password4: string | null
          password5: string | null
          payment_notes: string | null
          phone: string | null
          plan_id: string | null
          plan_name: string | null
          plan_price: number | null
          referral_code: string | null
          referred_by: string | null
          screens: number | null
          seller_id: string
          server_id: string | null
          server_ids: string[] | null
          server_name: string | null
          shared_panel_id: string | null
          shared_slot_type: string | null
          telegram: string | null
          updated_at: string | null
        }
        Insert: {
          account_type?: string | null
          app_name?: string | null
          created_at?: string | null
          device?: string | null
          email?: string | null
          expiration_date: string
          id?: string
          is_annual_paid?: boolean | null
          is_paid?: boolean | null
          login?: string | null
          login2?: string | null
          login3?: string | null
          login4?: string | null
          login5?: string | null
          mac_address?: string | null
          name: string
          notes?: string | null
          password?: string | null
          password2?: string | null
          password3?: string | null
          password4?: string | null
          password5?: string | null
          payment_notes?: string | null
          phone?: string | null
          plan_id?: string | null
          plan_name?: string | null
          plan_price?: number | null
          referral_code?: string | null
          referred_by?: string | null
          screens?: number | null
          seller_id: string
          server_id?: string | null
          server_ids?: string[] | null
          server_name?: string | null
          shared_panel_id?: string | null
          shared_slot_type?: string | null
          telegram?: string | null
          updated_at?: string | null
        }
        Update: {
          account_type?: string | null
          app_name?: string | null
          created_at?: string | null
          device?: string | null
          email?: string | null
          expiration_date?: string
          id?: string
          is_annual_paid?: boolean | null
          is_paid?: boolean | null
          login?: string | null
          login2?: string | null
          login3?: string | null
          login4?: string | null
          login5?: string | null
          mac_address?: string | null
          name?: string
          notes?: string | null
          password?: string | null
          password2?: string | null
          password3?: string | null
          password4?: string | null
          password5?: string | null
          payment_notes?: string | null
          phone?: string | null
          plan_id?: string | null
          plan_name?: string | null
          plan_price?: number | null
          referral_code?: string | null
          referred_by?: string | null
          screens?: number | null
          seller_id?: string
          server_id?: string | null
          server_ids?: string[] | null
          server_name?: string | null
          shared_panel_id?: string | null
          shared_slot_type?: string | null
          telegram?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_referred_by_fkey"
            columns: ["referred_by"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_shared_panel_id_fkey"
            columns: ["shared_panel_id"]
            isOneToOne: false
            referencedRelation: "shared_panels"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usages: {
        Row: {
          client_id: string
          coupon_id: string
          created_at: string
          discount_applied: number
          final_price: number
          id: string
          original_price: number
          seller_id: string
        }
        Insert: {
          client_id: string
          coupon_id: string
          created_at?: string
          discount_applied: number
          final_price: number
          id?: string
          original_price: number
          seller_id: string
        }
        Update: {
          client_id?: string
          coupon_id?: string
          created_at?: string
          discount_applied?: number
          final_price?: number
          id?: string
          original_price?: number
          seller_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupon_usages_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          current_uses: number
          discount_type: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_plan_value: number | null
          name: string
          seller_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          current_uses?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_plan_value?: number | null
          name: string
          seller_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          current_uses?: number
          discount_type?: Database["public"]["Enums"]["discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_plan_value?: number | null
          name?: string
          seller_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          created_at: string
          email: string
          id: string
          ip_address: string | null
          is_successful: boolean
        }
        Insert: {
          attempted_at?: string
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          is_successful?: boolean
        }
        Update: {
          attempted_at?: string
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          is_successful?: boolean
        }
        Relationships: []
      }
      message_history: {
        Row: {
          client_id: string | null
          client_name: string
          client_phone: string | null
          created_at: string
          delivered_at: string | null
          delivery_status: string
          id: string
          message_content: string
          message_type: string
          seller_id: string
          sent_at: string
        }
        Insert: {
          client_id?: string | null
          client_name: string
          client_phone?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          id?: string
          message_content: string
          message_type: string
          seller_id: string
          sent_at?: string
        }
        Update: {
          client_id?: string | null
          client_name?: string
          client_phone?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_status?: string
          id?: string
          message_content?: string
          message_type?: string
          seller_id?: string
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_history_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          days_before: Json
          id: string
          is_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days_before?: Json
          id?: string
          is_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          days_before?: Json
          id?: string
          is_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          created_at: string | null
          description: string | null
          duration_days: number
          id: string
          is_active: boolean | null
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          duration_days: number
          id?: string
          is_active?: boolean | null
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          duration_days?: number
          id?: string
          is_active?: boolean | null
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          commission_percentage: number | null
          created_at: string | null
          deleted_at: string | null
          email: string
          full_name: string | null
          has_pro_export: boolean | null
          has_unlimited_clients: boolean | null
          id: string
          is_active: boolean | null
          is_permanent: boolean | null
          pro_export_expires_at: string | null
          seller_plan_id: string | null
          subscription_expires_at: string | null
          temp_password_expires_at: string | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          commission_percentage?: number | null
          created_at?: string | null
          deleted_at?: string | null
          email: string
          full_name?: string | null
          has_pro_export?: boolean | null
          has_unlimited_clients?: boolean | null
          id: string
          is_active?: boolean | null
          is_permanent?: boolean | null
          pro_export_expires_at?: string | null
          seller_plan_id?: string | null
          subscription_expires_at?: string | null
          temp_password_expires_at?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          commission_percentage?: number | null
          created_at?: string | null
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          has_pro_export?: boolean | null
          has_unlimited_clients?: boolean | null
          id?: string
          is_active?: boolean | null
          is_permanent?: boolean | null
          pro_export_expires_at?: string | null
          seller_plan_id?: string | null
          subscription_expires_at?: string | null
          temp_password_expires_at?: string | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_seller_plan_id_fkey"
            columns: ["seller_plan_id"]
            isOneToOne: false
            referencedRelation: "seller_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referrals: {
        Row: {
          completed_at: string | null
          coupon_id: string | null
          created_at: string
          discount_percentage: number
          id: string
          referred_client_id: string
          referrer_client_id: string
          seller_id: string
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          coupon_id?: string | null
          created_at?: string
          discount_percentage?: number
          id?: string
          referred_client_id: string
          referrer_client_id: string
          seller_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          coupon_id?: string | null
          created_at?: string
          discount_percentage?: number
          id?: string
          referred_client_id?: string
          referrer_client_id?: string
          seller_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referrals_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referred_client_id_fkey"
            columns: ["referred_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_referrer_client_id_fkey"
            columns: ["referrer_client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_plans: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_best_value: boolean | null
          max_clients: number | null
          name: string
          price_monthly: number
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_best_value?: boolean | null
          max_clients?: number | null
          name: string
          price_monthly?: number
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_best_value?: boolean | null
          max_clients?: number | null
          name?: string
          price_monthly?: number
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      servers: {
        Row: {
          created_at: string | null
          credit_cost: number | null
          credit_recharge_cost: number | null
          id: string
          is_active: boolean | null
          monthly_cost: number | null
          name: string
          notes: string | null
          payment_due_date: string | null
          seller_id: string
          total_credits: number | null
          updated_at: string | null
          used_credits: number | null
        }
        Insert: {
          created_at?: string | null
          credit_cost?: number | null
          credit_recharge_cost?: number | null
          id?: string
          is_active?: boolean | null
          monthly_cost?: number | null
          name: string
          notes?: string | null
          payment_due_date?: string | null
          seller_id: string
          total_credits?: number | null
          updated_at?: string | null
          used_credits?: number | null
        }
        Update: {
          created_at?: string | null
          credit_cost?: number | null
          credit_recharge_cost?: number | null
          id?: string
          is_active?: boolean | null
          monthly_cost?: number | null
          name?: string
          notes?: string | null
          payment_due_date?: string | null
          seller_id?: string
          total_credits?: number | null
          updated_at?: string | null
          used_credits?: number | null
        }
        Relationships: []
      }
      shared_panels: {
        Row: {
          created_at: string
          id: string
          iptv_slots: number
          name: string
          p2p_slots: number
          seller_id: string
          total_slots: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          iptv_slots?: number
          name: string
          p2p_slots?: number
          seller_id: string
          total_slots?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          iptv_slots?: number
          name?: string
          p2p_slots?: number
          seller_id?: string
          total_slots?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      whatsapp_templates: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          message: string
          name: string
          seller_id: string
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          message: string
          name: string
          seller_id: string
          type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          message?: string
          name?: string
          seller_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "seller"
      discount_type: "percentage" | "fixed"
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
      app_role: ["admin", "seller"],
      discount_type: ["percentage", "fixed"],
    },
  },
} as const
