// Generated from project matnispbauvvlnbsuzxq via mcp Supabase generate_typescript_types,
// last regenerated 2026-08-18 (see db/MIGRATIONS.md for every migration this reflects).
// Regenerate after every schema migration (AGENTS.md Section 3.1, step 6) — do not hand-edit.

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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      apps: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          key: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          key?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      department_access_grants: {
        Row: {
          access_level: Database["public"]["Enums"]["access_level"]
          department_id: string
          employee_id: string
          granted_at: string
          granted_by: string | null
          id: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["access_level"]
          department_id: string
          employee_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["access_level"]
          department_id?: string
          employee_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_access_grants_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_access_grants_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_access_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          parent_department_id: string | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          parent_department_id?: string | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          parent_department_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_department_id_fkey"
            columns: ["parent_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      drivers: {
        Row: {
          created_at: string
          department_id: string | null
          driver_code: string
          full_name: string
          id: string
          phone: string
          photo_path: string | null
          status: Database["public"]["Enums"]["driver_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          driver_code: string
          full_name: string
          id?: string
          phone: string
          photo_path?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string | null
          driver_code?: string
          full_name?: string
          id?: string
          phone?: string
          photo_path?: string | null
          status?: Database["public"]["Enums"]["driver_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "drivers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_roles: {
        Row: {
          created_at: string
          department_id: string | null
          employee_id: string
          id: string
          role_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          department_id?: string | null
          employee_id: string
          id?: string
          role_id: string
          valid_from?: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string | null
          employee_id?: string
          id?: string
          role_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_roles_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_roles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employee_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          auth_user_id: string | null
          avatar_path: string | null
          created_at: string
          department_id: string | null
          email: string
          employee_code: string
          employment_type: Database["public"]["Enums"]["employment_type"]
          full_name: string
          id: string
          joined_at: string | null
          manager_id: string | null
          phone: string | null
          primary_role_id: string | null
          status: Database["public"]["Enums"]["employee_status"]
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          avatar_path?: string | null
          created_at?: string
          department_id?: string | null
          email: string
          employee_code: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name: string
          id?: string
          joined_at?: string | null
          manager_id?: string | null
          phone?: string | null
          primary_role_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          avatar_path?: string | null
          created_at?: string
          department_id?: string | null
          email?: string
          employee_code?: string
          employment_type?: Database["public"]["Enums"]["employment_type"]
          full_name?: string
          id?: string
          joined_at?: string | null
          manager_id?: string | null
          phone?: string | null
          primary_role_id?: string | null
          status?: Database["public"]["Enums"]["employee_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_primary_role_id_fkey"
            columns: ["primary_role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          created_at: string
          description: string | null
          driver_id: string
          employee_id: string | null
          guest_id: string | null
          id: string
          journey_id: string | null
          rating: number
          review_status: Database["public"]["Enums"]["feedback_review_status"]
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_auth_user_id: string | null
          travel_date: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          driver_id: string
          employee_id?: string | null
          guest_id?: string | null
          id?: string
          journey_id?: string | null
          rating: number
          review_status?: Database["public"]["Enums"]["feedback_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_auth_user_id?: string | null
          travel_date: string
        }
        Update: {
          created_at?: string
          description?: string | null
          driver_id?: string
          employee_id?: string | null
          guest_id?: string | null
          id?: string
          journey_id?: string | null
          rating?: number
          review_status?: Database["public"]["Enums"]["feedback_review_status"]
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_auth_user_id?: string | null
          travel_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      guests: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      journey_guests: {
        Row: {
          created_at: string
          guest_id: string
          id: string
          journey_id: string
        }
        Insert: {
          created_at?: string
          guest_id: string
          id?: string
          journey_id: string
        }
        Update: {
          created_at?: string
          guest_id?: string
          id?: string
          journey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_guests_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_guests_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_stop_guests: {
        Row: {
          action: Database["public"]["Enums"]["stop_guest_action"]
          created_at: string
          id: string
          journey_guest_id: string
          stop_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["stop_guest_action"]
          created_at?: string
          id?: string
          journey_guest_id: string
          stop_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["stop_guest_action"]
          created_at?: string
          id?: string
          journey_guest_id?: string
          stop_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_stop_guests_journey_guest_id_fkey"
            columns: ["journey_guest_id"]
            isOneToOne: false
            referencedRelation: "journey_guests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journey_stop_guests_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "journey_stops"
            referencedColumns: ["id"]
          },
        ]
      }
      journey_stops: {
        Row: {
          arrival_at: string
          created_at: string
          id: string
          journey_id: string
          location_name: string
          role: Database["public"]["Enums"]["stop_role"]
          sequence_no: number
          updated_at: string
        }
        Insert: {
          arrival_at: string
          created_at?: string
          id?: string
          journey_id: string
          location_name: string
          role: Database["public"]["Enums"]["stop_role"]
          sequence_no: number
          updated_at?: string
        }
        Update: {
          arrival_at?: string
          created_at?: string
          id?: string
          journey_id?: string
          location_name?: string
          role?: Database["public"]["Enums"]["stop_role"]
          sequence_no?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "journey_stops_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "journeys"
            referencedColumns: ["id"]
          },
        ]
      }
      journeys: {
        Row: {
          busy_window: unknown
          created_at: string
          created_by: string
          date_from: string
          date_to: string
          driver_id: string
          first_pickup_at: string
          id: string
          last_drop_at: string
          notes: string | null
          status: Database["public"]["Enums"]["journey_status"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          busy_window?: unknown
          created_at?: string
          created_by: string
          date_from: string
          date_to: string
          driver_id: string
          first_pickup_at: string
          id?: string
          last_drop_at: string
          notes?: string | null
          status?: Database["public"]["Enums"]["journey_status"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          busy_window?: unknown
          created_at?: string
          created_by?: string
          date_from?: string
          date_to?: string
          driver_id?: string
          first_pickup_at?: string
          id?: string
          last_drop_at?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["journey_status"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journeys_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "drivers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "journeys_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          app_id: string | null
          created_at: string
          description: string | null
          id: string
          key: string
        }
        Insert: {
          app_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key: string
        }
        Update: {
          app_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string
        }
        Relationships: [
          {
            foreignKeyName: "permissions_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
        ]
      }
      role_app_access: {
        Row: {
          access_level: Database["public"]["Enums"]["app_access_level"]
          app_id: string
          created_at: string
          id: string
          role_id: string
          updated_at: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["app_access_level"]
          app_id: string
          created_at?: string
          id?: string
          role_id: string
          updated_at?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["app_access_level"]
          app_id?: string
          created_at?: string
          id?: string
          role_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_app_access_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_app_access_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string
          id: string
          permission_id: string
          role_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          permission_id: string
          role_id: string
        }
        Update: {
          created_at?: string
          id?: string
          permission_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_global: boolean
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_global?: boolean
          name?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          created_at: string
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id: string
          make: string
          model: string
          name: string
          qr_code_url: string | null
          registration_number: string
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          fuel_type: Database["public"]["Enums"]["fuel_type"]
          id?: string
          make: string
          model: string
          name: string
          qr_code_url?: string | null
          registration_number: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          fuel_type?: Database["public"]["Enums"]["fuel_type"]
          id?: string
          make?: string
          model?: string
          name?: string
          qr_code_url?: string | null
          registration_number?: string
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      employee_hierarchy_view: {
        Row: {
          depth: number | null
          id: string | null
          manager_id: string | null
          path: string[] | null
          root_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      create_journey: { Args: { payload: Json }; Returns: string }
      next_driver_code: { Args: never; Returns: string }
      update_journey: {
        Args: { p_journey_id: string; payload: Json }
        Returns: undefined
      }
    }
    Enums: {
      access_level: "view" | "manage" | "admin"
      app_access_level: "none" | "view" | "manage"
      driver_status: "active" | "inactive"
      employee_status:
        | "invited"
        | "active"
        | "inactive"
        | "on_leave"
        | "offboarded"
      employment_type:
        | "full_time"
        | "part_time"
        | "contract"
        | "intern"
        | "consultant"
      feedback_review_status: "pending" | "approved" | "rejected"
      fuel_type: "diesel" | "ev" | "petrol"
      journey_status: "planned" | "ongoing" | "completed" | "cancelled"
      stop_guest_action: "pickup" | "drop"
      stop_role: "origin" | "stop" | "destination"
      vehicle_status: "vacant" | "on_trip" | "maintenance"
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
      access_level: ["view", "manage", "admin"],
      app_access_level: ["none", "view", "manage"],
      driver_status: ["active", "inactive"],
      employee_status: [
        "invited",
        "active",
        "inactive",
        "on_leave",
        "offboarded",
      ],
      employment_type: [
        "full_time",
        "part_time",
        "contract",
        "intern",
        "consultant",
      ],
      feedback_review_status: ["pending", "approved", "rejected"],
      fuel_type: ["diesel", "ev", "petrol"],
      journey_status: ["planned", "ongoing", "completed", "cancelled"],
      stop_guest_action: ["pickup", "drop"],
      stop_role: ["origin", "stop", "destination"],
      vehicle_status: ["vacant", "on_trip", "maintenance"],
    },
  },
} as const
