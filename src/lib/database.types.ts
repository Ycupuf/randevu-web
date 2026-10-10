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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      appointment_items: {
        Row: {
          appointment_id: string
          duration_min: number
          id: string
          name: string
          price_cents: number | null
          service_id: string | null
          variant_id: string | null
        }
        Insert: {
          appointment_id: string
          duration_min: number
          id?: string
          name: string
          price_cents?: number | null
          service_id?: string | null
          variant_id?: string | null
        }
        Update: {
          appointment_id?: string
          duration_min?: number
          id?: string
          name?: string
          price_cents?: number | null
          service_id?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointment_items_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointment_items_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "service_variants"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          blocks_until: string
          business_id: string
          cancel_reason: string | null
          cancelled_by: string | null
          rescheduled_by: string | null
          created_at: string
          customer_id: string
          ends_at: string
          field_answers: Json
          id: string
          note: string | null
          resource_id: string
          source: Database["public"]["Enums"]["appointment_source"]
          starts_at: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
        }
        Insert: {
          blocks_until: string
          business_id: string
          cancel_reason?: string | null
          cancelled_by?: string | null
          rescheduled_by?: string | null
          created_at?: string
          customer_id: string
          ends_at: string
          field_answers?: Json
          id?: string
          note?: string | null
          resource_id: string
          source?: Database["public"]["Enums"]["appointment_source"]
          starts_at: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Update: {
          blocks_until?: string
          business_id?: string
          cancel_reason?: string | null
          cancelled_by?: string | null
          rescheduled_by?: string | null
          created_at?: string
          customer_id?: string
          ends_at?: string
          field_answers?: Json
          id?: string
          note?: string | null
          resource_id?: string
          source?: Database["public"]["Enums"]["appointment_source"]
          starts_at?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_fields: {
        Row: {
          business_id: string
          field_type: string
          id: string
          key: string
          label: string
          required: boolean
          sort: number
        }
        Insert: {
          business_id: string
          field_type?: string
          id?: string
          key: string
          label: string
          required?: boolean
          sort?: number
        }
        Update: {
          business_id?: string
          field_type?: string
          id?: string
          key?: string
          label?: string
          required?: boolean
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "booking_fields_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          created_at: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_settings: {
        Row: {
          approval_mode: Database["public"]["Enums"]["approval_mode"]
          business_id: string
          cancel_window_min: number
          horizon_days: number
          max_active_per_customer: number
          min_notice_min: number
          resource_label: string
          resource_selection: Database["public"]["Enums"]["resource_selection"]
          service_label: string
          step_min: number
        }
        Insert: {
          approval_mode?: Database["public"]["Enums"]["approval_mode"]
          business_id: string
          cancel_window_min?: number
          horizon_days?: number
          max_active_per_customer?: number
          min_notice_min?: number
          resource_label?: string
          resource_selection?: Database["public"]["Enums"]["resource_selection"]
          service_label?: string
          step_min?: number
        }
        Update: {
          approval_mode?: Database["public"]["Enums"]["approval_mode"]
          business_id?: string
          cancel_window_min?: number
          horizon_days?: number
          max_active_per_customer?: number
          min_notice_min?: number
          resource_label?: string
          resource_selection?: Database["public"]["Enums"]["resource_selection"]
          service_label?: string
          step_min?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: true
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          description: string | null
          id: string
          is_demo: boolean
          name: string
          phone: string | null
          published: boolean
          sector: string
          slug: string
          timezone: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name: string
          phone?: string | null
          published?: boolean
          sector: string
          slug: string
          timezone?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          phone?: string | null
          published?: boolean
          sector?: string
          slug?: string
          timezone?: string
        }
        Relationships: []
      }
      customer_notes: {
        Row: {
          business_id: string
          customer_id: string
          note: string
          updated_at: string
        }
        Insert: {
          business_id: string
          customer_id: string
          note: string
          updated_at?: string
        }
        Update: {
          business_id?: string
          customer_id?: string
          note?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          business_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          user_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      data_requests: {
        Row: {
          created_at: string
          id: string
          kind: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          appointment_id: string | null
          business_id: string
          created_at: string
          customer_id: string | null
          data: Json
          extra_resource_id: string | null
          id: string
          resource_id: string | null
          type: string
        }
        Insert: {
          appointment_id?: string | null
          business_id: string
          created_at?: string
          customer_id?: string | null
          data?: Json
          extra_resource_id?: string | null
          id?: string
          resource_id?: string | null
          type: string
        }
        Update: {
          appointment_id?: string | null
          business_id?: string
          created_at?: string
          customer_id?: string | null
          data?: Json
          extra_resource_id?: string | null
          id?: string
          resource_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_extra_resource_id_fkey"
            columns: ["extra_resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_services: {
        Row: {
          resource_id: string
          service_id: string
        }
        Insert: {
          resource_id: string
          service_id: string
        }
        Update: {
          resource_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "resource_services_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resource_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          active: boolean
          business_id: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["resource_kind"]
          name: string
          sort: number
          user_id: string | null
        }
        Insert: {
          active?: boolean
          business_id: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["resource_kind"]
          name: string
          sort?: number
          user_id?: string | null
        }
        Update: {
          active?: boolean
          business_id?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["resource_kind"]
          name?: string
          sort?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_variants: {
        Row: {
          duration_min: number
          id: string
          name: string
          price_cents: number | null
          service_id: string
          sort: number
        }
        Insert: {
          duration_min: number
          id?: string
          name: string
          price_cents?: number | null
          service_id: string
          sort?: number
        }
        Update: {
          duration_min?: number
          id?: string
          name?: string
          price_cents?: number | null
          service_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_variants_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          buffer_after_min: number
          business_id: string
          category: string | null
          created_at: string
          description: string | null
          duration_min: number
          id: string
          name: string
          price_cents: number | null
          sort: number
        }
        Insert: {
          active?: boolean
          buffer_after_min?: number
          business_id: string
          category?: string | null
          created_at?: string
          description?: string | null
          duration_min: number
          id?: string
          name: string
          price_cents?: number | null
          sort?: number
        }
        Update: {
          active?: boolean
          buffer_after_min?: number
          business_id?: string
          category?: string | null
          created_at?: string
          description?: string | null
          duration_min?: number
          id?: string
          name?: string
          price_cents?: number | null
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "services_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      time_off: {
        Row: {
          business_id: string
          ends_at: string
          id: string
          reason: string | null
          resource_id: string | null
          starts_at: string
        }
        Insert: {
          business_id: string
          ends_at: string
          id?: string
          reason?: string | null
          resource_id?: string | null
          starts_at: string
        }
        Update: {
          business_id?: string
          ends_at?: string
          id?: string
          reason?: string | null
          resource_id?: string | null
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_off_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "time_off_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
      working_hours: {
        Row: {
          end_time: string
          id: string
          resource_id: string
          start_time: string
          weekday: number
        }
        Insert: {
          end_time: string
          id?: string
          resource_id: string
          start_time: string
          weekday: number
        }
        Update: {
          end_time?: string
          id?: string
          resource_id?: string
          start_time?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "working_hours_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "resources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      busy_slots: {
        Args: { p_from: string; p_resource_ids: string[]; p_to: string }
        Returns: {
          ends_at: string
          resource_id: string
          starts_at: string
        }[]
      }
      cancel_appointment: {
        Args: { p_id: string; p_reason?: string }
        Returns: undefined
      }
      create_appointment: {
        Args: {
          p_business_id: string
          p_customer?: Json
          p_customer_id?: string
          p_field_answers?: Json
          p_items: Json
          p_note?: string
          p_resource_id?: string
          p_starts_at: string
        }
        Returns: string
      }
      create_walkin_customer: {
        Args: { p_business_id: string; p_full_name: string; p_phone?: string }
        Returns: string
      }
      create_business: {
        Args: {
          p_address?: string
          p_city?: string
          p_name: string
          p_phone?: string
          p_sector: string
          p_slug: string
        }
        Returns: string
      }
      mark_notifications_read: {
        Args: { p_business_id: string }
        Returns: undefined
      }
      replace_working_hours: {
        Args: { p_resource_id: string; p_rows: Json }
        Returns: undefined
      }
      reschedule_appointment: {
        Args: { p_id: string; p_new_starts_at: string; p_resource_id?: string }
        Returns: undefined
      }
      reset_demo_customer: { Args: never; Returns: number }
      reset_demo_owner: { Args: never; Returns: number }
      set_appointment_status: {
        Args: {
          p_id: string
          p_status: Database["public"]["Enums"]["appointment_status"]
        }
        Returns: undefined
      }
      unread_notification_count: {
        Args: { p_business_id: string }
        Returns: number
      }
    }
    Enums: {
      appointment_source: "online" | "manual"
      appointment_status:
        | "pending"
        | "confirmed"
        | "cancelled"
        | "completed"
        | "no_show"
      approval_mode: "auto" | "manual"
      member_role: "owner" | "staff"
      resource_kind: "person" | "bay" | "room"
      resource_selection: "customer" | "any" | "auto"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      appointment_source: ["online", "manual"],
      appointment_status: [
        "pending",
        "confirmed",
        "cancelled",
        "completed",
        "no_show",
      ],
      approval_mode: ["auto", "manual"],
      member_role: ["owner", "staff"],
      resource_kind: ["person", "bay", "room"],
      resource_selection: ["customer", "any", "auto"],
    },
  },
} as const
