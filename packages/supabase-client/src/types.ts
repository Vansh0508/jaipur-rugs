// Generated from project matnispbauvvlnbsuzxq via mcp Supabase generate_typescript_types,
// regenerated 2026-09-12 (see db/MIGRATIONS.md for every migration this reflects) — the
// previous regeneration was 2026-08-19; this refresh was triggered by
// 022_column_requests.sql landing (db/orders/022) and, separately, catches up every
// orders-module migration since (013-020) whose tables/columns had been living here as
// a hand-authored stand-in per this header comment's old note (that note itself was
// stale — the migration it was waiting on landed long ago; this regeneration finally
// replaces it). Regenerate after every schema migration (AGENTS.md Section 3.1, step 6)
// — do not hand-edit.
//
// EXCEPTION, tracked explicitly rather than silently violating the rule above:
// `user_orders_view_preferences` (Row/Insert/Update/Relationships below) and
// `column_request_status`'s 'approved' value are hand-authored, because
// 023_user_view_preferences_and_request_approval.sql hasn't been applied to the live
// project yet as of this commit (the Supabase MCP connection dropped mid-session — see
// db/MIGRATIONS.md's entry on this) — there's no live schema to generate from yet.
// Re-run generate_typescript_types and replace this whole file once that migration
// actually lands; don't hand-edit this section further in the meantime.
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
      department_customer_codes: {
        Row: {
          created_at: string
          customer_no: string
          department_id: string
          id: string
        }
        Insert: {
          created_at?: string
          customer_no: string
          department_id: string
          id?: string
        }
        Update: {
          created_at?: string
          customer_no?: string
          department_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_customer_codes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
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
      document_checks: {
        Row: {
          created_at: string
          decided_at: string | null
          decided_by: string | null
          expected: Json
          extracted: Json
          findings: Json
          id: string
          kind: Database["public"]["Enums"]["inbound_document_kind"]
          mismatch_count: number
          not_found_count: number
          shipment_id: string
          source_document_id: string | null
          status: Database["public"]["Enums"]["check_status"]
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          expected: Json
          extracted: Json
          findings: Json
          id?: string
          kind: Database["public"]["Enums"]["inbound_document_kind"]
          mismatch_count: number
          not_found_count: number
          shipment_id: string
          source_document_id?: string | null
          status?: Database["public"]["Enums"]["check_status"]
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          expected?: Json
          extracted?: Json
          findings?: Json
          id?: string
          kind?: Database["public"]["Enums"]["inbound_document_kind"]
          mismatch_count?: number
          not_found_count?: number
          shipment_id?: string
          source_document_id?: string | null
          status?: Database["public"]["Enums"]["check_status"]
        }
        Relationships: [
          {
            foreignKeyName: "document_checks_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_checks_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_checks_source_document_id_fkey"
            columns: ["source_document_id"]
            isOneToOne: false
            referencedRelation: "shipment_documents"
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
      employee_salesperson_codes: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          salesperson_code: string
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          salesperson_code: string
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          salesperson_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_salesperson_codes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
          onboarding_completed_at: string | null
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
          onboarding_completed_at?: string | null
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
          onboarding_completed_at?: string | null
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
      escalation_levels: {
        Row: {
          created_at: string
          label: string
          level: number
          notify_employee_id: string | null
        }
        Insert: {
          created_at?: string
          label: string
          level: number
          notify_employee_id?: string | null
        }
        Update: {
          created_at?: string
          label?: string
          level?: number
          notify_employee_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "escalation_levels_notify_employee_id_fkey"
            columns: ["notify_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
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
      filing_proposals: {
        Row: {
          approved_category: string | null
          approved_financial_year: string | null
          approved_folder_name: string | null
          approved_location: string | null
          category_confirmed: boolean
          claimed_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          executed_at: string | null
          execution_error: string | null
          filed_file_names: string[] | null
          filed_listed_at: string | null
          id: string
          invoice_no: string | null
          proposed_category: string
          proposed_financial_year: string
          proposed_folder_name: string
          proposed_location: string
          routing_conflict: string | null
          series: string | null
          shipment_id: string
          status: Database["public"]["Enums"]["filing_status"]
          warehouse_no: string
          written_path: string | null
        }
        Insert: {
          approved_category?: string | null
          approved_financial_year?: string | null
          approved_folder_name?: string | null
          approved_location?: string | null
          category_confirmed?: boolean
          claimed_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          executed_at?: string | null
          execution_error?: string | null
          filed_file_names?: string[] | null
          filed_listed_at?: string | null
          id?: string
          invoice_no?: string | null
          proposed_category: string
          proposed_financial_year: string
          proposed_folder_name: string
          proposed_location: string
          routing_conflict?: string | null
          series?: string | null
          shipment_id: string
          status?: Database["public"]["Enums"]["filing_status"]
          warehouse_no: string
          written_path?: string | null
        }
        Update: {
          approved_category?: string | null
          approved_financial_year?: string | null
          approved_folder_name?: string | null
          approved_location?: string | null
          category_confirmed?: boolean
          claimed_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          executed_at?: string | null
          execution_error?: string | null
          filed_file_names?: string[] | null
          filed_listed_at?: string | null
          id?: string
          invoice_no?: string | null
          proposed_category?: string
          proposed_financial_year?: string
          proposed_folder_name?: string
          proposed_location?: string
          routing_conflict?: string | null
          series?: string | null
          shipment_id?: string
          status?: Database["public"]["Enums"]["filing_status"]
          warehouse_no?: string
          written_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "filing_proposals_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "filing_proposals_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      filing_serial_counters: {
        Row: {
          category: string
          financial_year: string
          last_serial: string
          location: string
          updated_at: string
        }
        Insert: {
          category: string
          financial_year: string
          last_serial: string
          location: string
          updated_at?: string
        }
        Update: {
          category?: string
          financial_year?: string
          last_serial?: string
          location?: string
          updated_at?: string
        }
        Relationships: []
      }
      follow_up_person_directory: {
        Row: {
          created_at: string
          email: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      freight_proposals: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          approved_cif_usd: number | null
          approved_freight_usd: number | null
          approved_insurance_usd: number | null
          computed_cif_usd: number
          computed_freight_usd: number
          computed_insurance_usd: number
          courier: Database["public"]["Enums"]["courier"]
          created_at: string
          id: string
          inputs: Json
          rate_card_id: string | null
          shipment_id: string
          status: Database["public"]["Enums"]["proposal_status"]
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          approved_cif_usd?: number | null
          approved_freight_usd?: number | null
          approved_insurance_usd?: number | null
          computed_cif_usd: number
          computed_freight_usd: number
          computed_insurance_usd: number
          courier: Database["public"]["Enums"]["courier"]
          created_at?: string
          id?: string
          inputs: Json
          rate_card_id?: string | null
          shipment_id: string
          status?: Database["public"]["Enums"]["proposal_status"]
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          approved_cif_usd?: number | null
          approved_freight_usd?: number | null
          approved_insurance_usd?: number | null
          computed_cif_usd?: number
          computed_freight_usd?: number
          computed_insurance_usd?: number
          courier?: Database["public"]["Enums"]["courier"]
          created_at?: string
          id?: string
          inputs?: Json
          rate_card_id?: string | null
          shipment_id?: string
          status?: Database["public"]["Enums"]["proposal_status"]
        }
        Relationships: [
          {
            foreignKeyName: "freight_proposals_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_proposals_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_proposals_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
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
      inbound_mails: {
        Row: {
          attachments: Json
          body_text: string
          cc_addresses: string[]
          claimed_at: string | null
          claimed_by: string | null
          claimed_shipment_id: string | null
          created_at: string
          customer_code: string | null
          dismissed_at: string | null
          dismissed_by: string | null
          from_address: string
          from_name: string | null
          id: string
          message_id: string | null
          mode: Database["public"]["Enums"]["shipment_mode"] | null
          received_at: string
          status: Database["public"]["Enums"]["inbound_mail_status"]
          subject: string
          to_addresses: string[]
          uid: number
          uid_validity: number
          warehouse_no: string | null
        }
        Insert: {
          attachments?: Json
          body_text: string
          cc_addresses?: string[]
          claimed_at?: string | null
          claimed_by?: string | null
          claimed_shipment_id?: string | null
          created_at?: string
          customer_code?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          from_address: string
          from_name?: string | null
          id?: string
          message_id?: string | null
          mode?: Database["public"]["Enums"]["shipment_mode"] | null
          received_at: string
          status?: Database["public"]["Enums"]["inbound_mail_status"]
          subject: string
          to_addresses?: string[]
          uid: number
          uid_validity: number
          warehouse_no?: string | null
        }
        Update: {
          attachments?: Json
          body_text?: string
          cc_addresses?: string[]
          claimed_at?: string | null
          claimed_by?: string | null
          claimed_shipment_id?: string | null
          created_at?: string
          customer_code?: string | null
          dismissed_at?: string | null
          dismissed_by?: string | null
          from_address?: string
          from_name?: string | null
          id?: string
          message_id?: string | null
          mode?: Database["public"]["Enums"]["shipment_mode"] | null
          received_at?: string
          status?: Database["public"]["Enums"]["inbound_mail_status"]
          subject?: string
          to_addresses?: string[]
          uid?: number
          uid_validity?: number
          warehouse_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_mails_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_mails_claimed_shipment_id_fkey"
            columns: ["claimed_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_mails_dismissed_by_fkey"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
      mail_drafts: {
        Row: {
          attach_filed_folder: boolean
          attached_file_names: string[] | null
          attachment_document_ids: string[]
          attachment_file_names: string[]
          body: string
          cc_addresses: string[]
          check_id: string | null
          claimed_at: string | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          kind: Database["public"]["Enums"]["mail_kind"]
          message_id: string | null
          send_error: string | null
          sent_at: string | null
          shipment_id: string
          status: Database["public"]["Enums"]["mail_status"]
          subject: string
          to_addresses: string[]
        }
        Insert: {
          attach_filed_folder?: boolean
          attached_file_names?: string[] | null
          attachment_document_ids?: string[]
          attachment_file_names?: string[]
          body: string
          cc_addresses?: string[]
          check_id?: string | null
          claimed_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["mail_kind"]
          message_id?: string | null
          send_error?: string | null
          sent_at?: string | null
          shipment_id: string
          status?: Database["public"]["Enums"]["mail_status"]
          subject: string
          to_addresses: string[]
        }
        Update: {
          attach_filed_folder?: boolean
          attached_file_names?: string[] | null
          attachment_document_ids?: string[]
          attachment_file_names?: string[]
          body?: string
          cc_addresses?: string[]
          check_id?: string | null
          claimed_at?: string | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["mail_kind"]
          message_id?: string | null
          send_error?: string | null
          sent_at?: string | null
          shipment_id?: string
          status?: Database["public"]["Enums"]["mail_status"]
          subject?: string
          to_addresses?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "mail_drafts_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "document_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_drafts_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_drafts_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_customer_codes: {
        Row: {
          created_at: string
          customer_no: string
          employee_id: string | null
          id: string
        }
        Insert: {
          created_at?: string
          customer_no: string
          employee_id?: string | null
          id?: string
        }
        Update: {
          created_at?: string
          customer_no?: string
          employee_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_customer_codes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      nav011_pull_requests: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          error: string | null
          id: string
          requested_at: string
          requested_by: string | null
          result: Json | null
          shipment_id: string
          status: Database["public"]["Enums"]["nav011_pull_status"]
          warehouse_no: string
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          error?: string | null
          id?: string
          requested_at?: string
          requested_by?: string | null
          result?: Json | null
          shipment_id: string
          status?: Database["public"]["Enums"]["nav011_pull_status"]
          warehouse_no: string
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          error?: string | null
          id?: string
          requested_at?: string
          requested_by?: string | null
          result?: Json | null
          shipment_id?: string
          status?: Database["public"]["Enums"]["nav011_pull_status"]
          warehouse_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "nav011_pull_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nav011_pull_requests_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      order_delay_alerts: {
        Row: {
          alert_date: string
          body: string
          created_at: string
          id: string
          order_id: string
          overdue_by_days: number
          pending_days: number
          recipients: Json
          sent_at: string | null
          stage_id: string | null
          standard_days: number
          subject: string
        }
        Insert: {
          alert_date?: string
          body: string
          created_at?: string
          id?: string
          order_id: string
          overdue_by_days: number
          pending_days: number
          recipients: Json
          sent_at?: string | null
          stage_id?: string | null
          standard_days: number
          subject: string
        }
        Update: {
          alert_date?: string
          body?: string
          created_at?: string
          id?: string
          order_id?: string
          overdue_by_days?: number
          pending_days?: number
          recipients?: Json
          sent_at?: string | null
          stage_id?: string | null
          standard_days?: number
          subject?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_delay_alerts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_delay_alerts_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      order_escalations: {
        Row: {
          created_at: string
          escalated_by: string
          id: string
          level: number
          order_id: string
          reason: string | null
        }
        Insert: {
          created_at?: string
          escalated_by: string
          id?: string
          level: number
          order_id: string
          reason?: string | null
        }
        Update: {
          created_at?: string
          escalated_by?: string
          id?: string
          level?: number
          order_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_escalations_escalated_by_fkey"
            columns: ["escalated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_escalations_level_fkey"
            columns: ["level"]
            isOneToOne: false
            referencedRelation: "escalation_levels"
            referencedColumns: ["level"]
          },
          {
            foreignKeyName: "order_escalations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_events: {
        Row: {
          action: string
          actor_employee_id: string | null
          actor_label: string
          created_at: string
          id: string
          order_id: string | null
          role: string | null
          snapshot: Json | null
        }
        Insert: {
          action: string
          actor_employee_id?: string | null
          actor_label: string
          created_at?: string
          id?: string
          order_id?: string | null
          role?: string | null
          snapshot?: Json | null
        }
        Update: {
          action?: string
          actor_employee_id?: string | null
          actor_label?: string
          created_at?: string
          id?: string
          order_id?: string | null
          role?: string | null
          snapshot?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "order_events_actor_employee_id_fkey"
            columns: ["actor_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_milestones: {
        Row: {
          created_at: string
          id: string
          milestone: Database["public"]["Enums"]["order_milestone_key"]
          note: string | null
          occurred_at: string
          order_id: string
          recorded_by: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          milestone: Database["public"]["Enums"]["order_milestone_key"]
          note?: string | null
          occurred_at?: string
          order_id: string
          recorded_by?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          milestone?: Database["public"]["Enums"]["order_milestone_key"]
          note?: string | null
          occurred_at?: string
          order_id?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_milestones_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_milestones_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      order_request_seen: {
        Row: {
          employee_id: string
          id: string
          request_id: string
          seen_at: string
        }
        Insert: {
          employee_id: string
          id?: string
          request_id: string
          seen_at?: string
        }
        Update: {
          employee_id?: string
          id?: string
          request_id?: string
          seen_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_request_seen_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_request_seen_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "order_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      order_requests: {
        Row: {
          actioned_at: string | null
          actioned_by: string | null
          blocked_reason: string | null
          created_at: string
          id: string
          note: string | null
          order_id: string
          psft: string | null
          request_type_id: string
          requested_by: string
          so_no: string | null
          status: Database["public"]["Enums"]["order_request_status"]
          warehouse_no: string | null
        }
        Insert: {
          actioned_at?: string | null
          actioned_by?: string | null
          blocked_reason?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id: string
          psft?: string | null
          request_type_id: string
          requested_by: string
          so_no?: string | null
          status?: Database["public"]["Enums"]["order_request_status"]
          warehouse_no?: string | null
        }
        Update: {
          actioned_at?: string | null
          actioned_by?: string | null
          blocked_reason?: string | null
          created_at?: string
          id?: string
          note?: string | null
          order_id?: string
          psft?: string | null
          request_type_id?: string
          requested_by?: string
          so_no?: string | null
          status?: Database["public"]["Enums"]["order_request_status"]
          warehouse_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_requests_actioned_by_fkey"
            columns: ["actioned_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_requests_request_type_id_fkey"
            columns: ["request_type_id"]
            isOneToOne: false
            referencedRelation: "request_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      order_stage_events: {
        Row: {
          created_at: string
          entered_at: string
          id: string
          order_id: string
          recorded_by: string | null
          source: Database["public"]["Enums"]["stage_event_source"]
          stage_id: string
        }
        Insert: {
          created_at?: string
          entered_at: string
          id?: string
          order_id: string
          recorded_by?: string | null
          source?: Database["public"]["Enums"]["stage_event_source"]
          stage_id: string
        }
        Update: {
          created_at?: string
          entered_at?: string
          id?: string
          order_id?: string
          recorded_by?: string | null
          source?: Database["public"]["Enums"]["stage_event_source"]
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_stage_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_stage_events_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_stage_events_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          authorization: string | null
          backing: string | null
          br_color_name: string | null
          construction: string | null
          created_at: string
          current_location: string | null
          current_status_pending_days: number | null
          customer_no: string | null
          customer_po_no: string | null
          customer_service_zone: string | null
          design: string | null
          erp_synced_at: string
          expected_ready_date: string | null
          follow_up_person: string | null
          gr_color_name: string | null
          hsn_sac_no: string | null
          id: string
          india_collection: string | null
          item_description: string | null
          item_no: string
          matching_code: string | null
          merchant_name: string | null
          on_hold: string | null
          order_priority: number | null
          order_wise_merchant: string | null
          original_ex_factory_date: string | null
          original_ex_india_date: string | null
          otn_no: string
          pile_fibre: string | null
          pile_height: string | null
          production_order_no: string | null
          production_order_status: string | null
          project_coordinator: string | null
          promised_delivery_date: string | null
          quality: string | null
          quick_ship: boolean
          raw_current_status: string | null
          remark: string | null
          revised_ex_factory_date: string | null
          revised_ex_india_date: string | null
          sales_line_no: number | null
          sales_order_date: string | null
          sales_order_no: string | null
          salesperson_code: string | null
          serial_no: string | null
          shape: string | null
          size: string | null
          size_cm: string | null
          stage_id: string | null
          std_cubage: number | null
          updated_at: string
          us_item_code: string | null
          warehouse_shipment_created: boolean
          // Dispatch + shipment tracking, added by db/orders/029_dispatch_tracking.sql —
          // see that migration and orders-sync.mjs's syncDispatchStatus/syncTrackingInfo
          // for where these come from (NAV-011 / a separate AWB-tracking NAV view, not
          // NAV_VIEW). Grouped here rather than alphabetized among the fields above.
          dispatched_at: string | null
          sales_shipment_no: string | null
          tracking_no: string | null
          shipping_agent_code: string | null
          shipping_agent_name: string | null
          ewb_no: string | null
          // Sticky "has this order ever been Late/Delayed" ratchet, added by
          // db/orders/040_sticky_late_status.sql — see that migration and
          // lib/tat.ts's onTimeStatus() for how it's used.
          ever_late: boolean
        }
        Insert: {
          authorization?: string | null
          backing?: string | null
          br_color_name?: string | null
          construction?: string | null
          created_at?: string
          current_location?: string | null
          current_status_pending_days?: number | null
          customer_no?: string | null
          customer_po_no?: string | null
          customer_service_zone?: string | null
          design?: string | null
          erp_synced_at?: string
          expected_ready_date?: string | null
          follow_up_person?: string | null
          gr_color_name?: string | null
          hsn_sac_no?: string | null
          id?: string
          india_collection?: string | null
          item_description?: string | null
          item_no: string
          matching_code?: string | null
          merchant_name?: string | null
          on_hold?: string | null
          order_priority?: number | null
          order_wise_merchant?: string | null
          original_ex_factory_date?: string | null
          original_ex_india_date?: string | null
          otn_no: string
          pile_fibre?: string | null
          pile_height?: string | null
          production_order_no?: string | null
          production_order_status?: string | null
          project_coordinator?: string | null
          promised_delivery_date?: string | null
          quality?: string | null
          quick_ship?: boolean
          raw_current_status?: string | null
          remark?: string | null
          revised_ex_factory_date?: string | null
          revised_ex_india_date?: string | null
          sales_line_no?: number | null
          sales_order_date?: string | null
          sales_order_no?: string | null
          salesperson_code?: string | null
          serial_no?: string | null
          shape?: string | null
          size?: string | null
          size_cm?: string | null
          stage_id?: string | null
          std_cubage?: number | null
          updated_at?: string
          us_item_code?: string | null
          warehouse_shipment_created?: boolean
          dispatched_at?: string | null
          sales_shipment_no?: string | null
          tracking_no?: string | null
          shipping_agent_code?: string | null
          shipping_agent_name?: string | null
          ewb_no?: string | null
          ever_late?: boolean
        }
        Update: {
          authorization?: string | null
          backing?: string | null
          br_color_name?: string | null
          construction?: string | null
          created_at?: string
          current_location?: string | null
          current_status_pending_days?: number | null
          customer_no?: string | null
          customer_po_no?: string | null
          customer_service_zone?: string | null
          design?: string | null
          erp_synced_at?: string
          expected_ready_date?: string | null
          follow_up_person?: string | null
          gr_color_name?: string | null
          hsn_sac_no?: string | null
          id?: string
          india_collection?: string | null
          item_description?: string | null
          item_no?: string
          matching_code?: string | null
          merchant_name?: string | null
          on_hold?: string | null
          order_priority?: number | null
          order_wise_merchant?: string | null
          original_ex_factory_date?: string | null
          original_ex_india_date?: string | null
          otn_no?: string
          pile_fibre?: string | null
          pile_height?: string | null
          production_order_no?: string | null
          production_order_status?: string | null
          project_coordinator?: string | null
          promised_delivery_date?: string | null
          quality?: string | null
          quick_ship?: boolean
          raw_current_status?: string | null
          remark?: string | null
          revised_ex_factory_date?: string | null
          revised_ex_india_date?: string | null
          sales_line_no?: number | null
          sales_order_date?: string | null
          sales_order_no?: string | null
          salesperson_code?: string | null
          serial_no?: string | null
          shape?: string | null
          size?: string | null
          size_cm?: string | null
          stage_id?: string | null
          std_cubage?: number | null
          updated_at?: string
          us_item_code?: string | null
          warehouse_shipment_created?: boolean
          dispatched_at?: string | null
          sales_shipment_no?: string | null
          tracking_no?: string | null
          shipping_agent_code?: string | null
          shipping_agent_name?: string | null
          ewb_no?: string | null
          ever_late?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "orders_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_column_requests: {
        Row: {
          created_at: string
          id: string
          nav_field_name: string
          notes: string | null
          requested_by: string
          resolved_at: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["column_request_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          nav_field_name: string
          notes?: string | null
          requested_by: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["column_request_status"]
        }
        Update: {
          created_at?: string
          id?: string
          nav_field_name?: string
          notes?: string | null
          requested_by?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["column_request_status"]
        }
        Relationships: [
          {
            foreignKeyName: "orders_column_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_column_requests_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      user_orders_view_preferences: {
        Row: {
          column_order: Json
          employee_id: string
          filter_order: Json
          hidden_columns: Json
          hidden_filters: Json
          row_height: string
          updated_at: string
        }
        Insert: {
          column_order?: Json
          employee_id: string
          filter_order?: Json
          hidden_columns?: Json
          hidden_filters?: Json
          row_height?: string
          updated_at?: string
        }
        Update: {
          column_order?: Json
          employee_id?: string
          filter_order?: Json
          hidden_columns?: Json
          hidden_filters?: Json
          row_height?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_orders_view_preferences_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: true
            referencedRelation: "employees"
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
      rate_bands: {
        Row: {
          id: string
          rate_card_id: string
          rates_by_zone: Json
          upto_kg: number
        }
        Insert: {
          id?: string
          rate_card_id: string
          rates_by_zone: Json
          upto_kg: number
        }
        Update: {
          id?: string
          rate_card_id?: string
          rates_by_zone?: Json
          upto_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "rate_bands_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_card_countries: {
        Row: {
          country_name: string
          id: string
          iso2: string | null
          rate_card_id: string
          zone: string
        }
        Insert: {
          country_name: string
          id?: string
          iso2?: string | null
          rate_card_id: string
          zone: string
        }
        Update: {
          country_name?: string
          id?: string
          iso2?: string | null
          rate_card_id?: string
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_card_countries_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_cards: {
        Row: {
          courier: Database["public"]["Enums"]["courier"]
          effective_date: string
          id: string
          imported_at: string
          source_file: string
        }
        Insert: {
          courier: Database["public"]["Enums"]["courier"]
          effective_date: string
          id?: string
          imported_at?: string
          source_file: string
        }
        Update: {
          courier?: Database["public"]["Enums"]["courier"]
          effective_date?: string
          id?: string
          imported_at?: string
          source_file?: string
        }
        Relationships: []
      }
      rate_tiers: {
        Row: {
          from_kg: number
          id: string
          rate_card_id: string
          rates_by_zone: Json
          to_kg: number
        }
        Insert: {
          from_kg: number
          id?: string
          rate_card_id: string
          rates_by_zone: Json
          to_kg: number
        }
        Update: {
          from_kg?: number
          id?: string
          rate_card_id?: string
          rates_by_zone?: Json
          to_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "rate_tiers_rate_card_id_fkey"
            columns: ["rate_card_id"]
            isOneToOne: false
            referencedRelation: "rate_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      request_types: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          location_dependent: boolean
          owning_department_code: string
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          location_dependent?: boolean
          owning_department_code: string
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          location_dependent?: boolean
          owning_department_code?: string
        }
        Relationships: []
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
      shipment_documents: {
        Row: {
          byte_size: number
          content_type: string | null
          created_at: string
          file_name: string
          id: string
          kind: Database["public"]["Enums"]["document_kind"]
          purged_at: string | null
          shipment_id: string
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          byte_size: number
          content_type?: string | null
          created_at?: string
          file_name: string
          id?: string
          kind: Database["public"]["Enums"]["document_kind"]
          purged_at?: string | null
          shipment_id: string
          storage_path: string
          uploaded_by?: string | null
        }
        Update: {
          byte_size?: number
          content_type?: string | null
          created_at?: string
          file_name?: string
          id?: string
          kind?: Database["public"]["Enums"]["document_kind"]
          purged_at?: string | null
          shipment_id?: string
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_documents_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_lines: {
        Row: {
          bale_no: string | null
          created_at: string
          design: string | null
          gross_weight_kg: number | null
          hs_code: string | null
          id: string
          line_amount_usd: number | null
          net_weight_kg: number | null
          quality: string | null
          quantity: number | null
          shipment_id: string
          size: string | null
          sq_mtr: number | null
        }
        Insert: {
          bale_no?: string | null
          created_at?: string
          design?: string | null
          gross_weight_kg?: number | null
          hs_code?: string | null
          id?: string
          line_amount_usd?: number | null
          net_weight_kg?: number | null
          quality?: string | null
          quantity?: number | null
          shipment_id: string
          size?: string | null
          sq_mtr?: number | null
        }
        Update: {
          bale_no?: string | null
          created_at?: string
          design?: string | null
          gross_weight_kg?: number | null
          hs_code?: string | null
          id?: string
          line_amount_usd?: number | null
          net_weight_kg?: number | null
          quality?: string | null
          quantity?: number | null
          shipment_id?: string
          size?: string | null
          sq_mtr?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_lines_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          bales: number | null
          buyer_name: string | null
          category: string | null
          cbm: number | null
          created_at: string
          created_by: string | null
          customer_code: string | null
          destination_country: string | null
          fob_usd: number | null
          gross_weight_kg: number | null
          id: string
          invoice_no: string | null
          location: string | null
          mode: Database["public"]["Enums"]["shipment_mode"]
          net_weight_kg: number | null
          series: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          updated_at: string
          warehouse_no: string
        }
        Insert: {
          bales?: number | null
          buyer_name?: string | null
          category?: string | null
          cbm?: number | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          destination_country?: string | null
          fob_usd?: number | null
          gross_weight_kg?: number | null
          id?: string
          invoice_no?: string | null
          location?: string | null
          mode: Database["public"]["Enums"]["shipment_mode"]
          net_weight_kg?: number | null
          series?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          updated_at?: string
          warehouse_no: string
        }
        Update: {
          bales?: number | null
          buyer_name?: string | null
          category?: string | null
          cbm?: number | null
          created_at?: string
          created_by?: string | null
          customer_code?: string | null
          destination_country?: string | null
          fob_usd?: number | null
          gross_weight_kg?: number | null
          id?: string
          invoice_no?: string | null
          location?: string | null
          mode?: Database["public"]["Enums"]["shipment_mode"]
          net_weight_kg?: number | null
          series?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          updated_at?: string
          warehouse_no?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_details: {
        Row: {
          carrier: string | null
          created_at: string
          foldable: boolean | null
          height_cm: number | null
          id: string
          length_cm: number | null
          notes: string | null
          order_id: string
          quote_status: Database["public"]["Enums"]["shipping_quote_status"]
          updated_at: string
          updated_by: string | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          carrier?: string | null
          created_at?: string
          foldable?: boolean | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          notes?: string | null
          order_id: string
          quote_status?: Database["public"]["Enums"]["shipping_quote_status"]
          updated_at?: string
          updated_by?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          carrier?: string | null
          created_at?: string
          foldable?: boolean | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
          notes?: string | null
          order_id?: string
          quote_status?: Database["public"]["Enums"]["shipping_quote_status"]
          updated_at?: string
          updated_by?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_details_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_details_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      stages: {
        Row: {
          code: string
          created_at: string
          display_name: string
          display_order: number
          id: string
          is_terminal: boolean
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          display_order: number
          id?: string
          is_terminal?: boolean
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          display_order?: number
          id?: string
          is_terminal?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      status_stage_map: {
        Row: {
          created_at: string
          id: string
          is_prefix: boolean
          raw_status: string
          stage_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_prefix?: boolean
          raw_status: string
          stage_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_prefix?: boolean
          raw_status?: string
          stage_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "status_stage_map_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
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
      claim_filing_jobs: { Args: { p_limit?: number }; Returns: Json }
      claim_inbound_mail: {
        Args: {
          p_category: string
          p_documents: Json
          p_employee_id: string
          p_location: string
          p_mail_id: string
          p_serial_override?: string
          p_shipment_id: string
        }
        Returns: Json
      }
      claim_mail_jobs: { Args: { p_limit?: number }; Returns: Json }
      claim_nav011_pull_jobs: { Args: { p_limit?: number }; Returns: Json }
      create_journey: { Args: { payload: Json }; Returns: string }
      create_shipping_shipment: { Args: { payload: Json }; Returns: Json }
      decide_document_check: {
        Args: {
          p_check_id: string
          p_decision: Database["public"]["Enums"]["check_status"]
          p_employee_id: string
        }
        Returns: Json
      }
      decide_filing_proposal: {
        Args: {
          p_category: string
          p_decision: Database["public"]["Enums"]["filing_status"]
          p_employee_id: string
          p_financial_year: string
          p_folder_name: string
          p_location: string
          p_proposal_id: string
        }
        Returns: Json
      }
      decide_freight_proposal: {
        Args: {
          p_decision: Database["public"]["Enums"]["proposal_status"]
          p_employee_id: string
          p_overridden_freight_usd: number
          p_proposal_id: string
        }
        Returns: Json
      }
      decide_mail_draft: {
        Args: {
          p_decision: Database["public"]["Enums"]["mail_status"]
          p_employee_id: string
          p_mail_id: string
        }
        Returns: Json
      }
      dismiss_inbound_mail: {
        Args: { p_employee_id: string; p_mail_id: string }
        Returns: Json
      }
      get_orders_sync_secret: { Args: never; Returns: string }
      list_deletable_documents: { Args: { p_limit?: number }; Returns: Json }
      list_folders_to_refresh: { Args: { p_limit?: number }; Returns: Json }
      mark_documents_purged: { Args: { p_ids: string[] }; Returns: number }
      next_driver_code: { Args: never; Returns: string }
      next_employee_code: { Args: never; Returns: string }
      next_filing_serial: {
        Args: {
          p_category: string
          p_financial_year: string
          p_location: string
        }
        Returns: string
      }
      orders_dashboard_stats: {
        Args: never
        Returns: {
          counts_by_stage: Json
          delayed_count: number
          distinct_sales_orders: number
          total: number
        }[]
      }
      orders_filtered_summary: {
        Args: {
          p_aging?: string
          p_ctype?: string
          p_customer_nos?: string[]
          p_customer_po_nos?: string[]
          p_delay_status?: string
          p_designs?: string[]
          p_due_from?: string
          p_due_to?: string
          p_follow_up_people?: string[]
          p_include_stock?: boolean
          p_merchant_names?: string[]
          p_on_hold?: string
          p_on_time_status?: string
          p_order_wise_merchants?: string[]
          p_priorities?: number[]
          p_production_order_statuses?: string[]
          p_qualities?: string[]
          p_quick_ship?: string
          p_search?: string
          p_sizes?: string[]
          p_stage_ids?: string[]
          p_terminal_stage_ids?: string[]
        }
        Returns: {
          by_stage: Json
          by_status: Json
          total_count: number
          total_sqft: number
        }[]
      }
      orders_list_facets: {
        Args: never
        Returns: {
          customer_no: string[]
          customer_po_no: string[]
          design: string[]
          follow_up_person: string[]
          merchant_name: string[]
          order_wise_merchant: string[]
          priority: string[]
          production_order_status: string[]
          quality: string[]
          size: string[]
        }[]
      }
      reconcile_filing_proposal_invoice: {
        Args: {
          p_derived_category: string
          p_derived_location: string
          p_employee_id: string
          p_invoice_no: string
          p_proposal_id: string
          p_series: string
        }
        Returns: Json
      }
      report_filed_folder: {
        Args: { p_file_names: string[]; p_proposal_id: string }
        Returns: Json
      }
      report_filing_result: {
        Args: { p_error: string; p_proposal_id: string; p_written_path: string }
        Returns: Json
      }
      report_mail_result: {
        Args: {
          p_attached_file_names?: string[]
          p_error: string
          p_mail_id: string
          p_message_id: string
        }
        Returns: Json
      }
      report_nav011_pull_result: {
        Args: { p_error: string; p_request_id: string; p_result: Json }
        Returns: Json
      }
      request_nav011_pull: {
        Args: { p_employee_id: string; p_shipment_id: string }
        Returns: string
      }
      rug_lens_facets: {
        Args: {
          p_include_held_or_assigned?: boolean
          p_item_type?: string
          p_location?: string[]
          p_quality?: string[]
          p_search?: string
          p_size?: string[]
        }
        Returns: {
          locations: string[]
          qualities: string[]
          sizes: string[]
        }[]
      }
      update_journey: {
        Args: { p_journey_id: string; payload: Json }
        Returns: undefined
      }
    }
    Enums: {
      access_level: "view" | "manage" | "admin"
      app_access_level: "none" | "view" | "manage"
      check_status: "pending" | "approved" | "rejected"
      column_request_status: "pending" | "approved" | "added" | "declined"
      courier: "dhl" | "fedex"
      document_kind:
        | "planning_mail"
        | "nav_invoice_mail"
        | "po"
        | "warehouse_sheet"
        | "invoice"
        | "buyer_invoice"
        | "packing_list"
        | "buyer_packing_list"
        | "evd"
        | "sli"
        | "awb"
        | "eway_bill"
        | "rodtep"
        | "import_declaration"
        | "other"
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
      filing_status: "pending" | "approved" | "rejected"
      fuel_type: "diesel" | "ev" | "petrol"
      inbound_document_kind: "cha_checklist" | "bl_draft" | "hawb_draft"
      inbound_mail_status: "unclaimed" | "claimed" | "dismissed"
      journey_status: "planned" | "ongoing" | "completed" | "cancelled"
      mail_kind:
        | "pack_to_packing_team"
        | "documents_to_merchant"
        | "correction_to_cha"
        | "correction_to_forwarder"
      mail_status: "draft" | "approved" | "sent" | "failed" | "rejected"
      nav011_pull_status: "pending" | "completed" | "failed"
      order_milestone_key: "qc_done" | "packed" | "dispatched" | "awb_issued"
      order_request_status:
        | "open"
        | "in_progress"
        | "blocked"
        | "done"
        | "rejected"
      proposal_status: "pending" | "approved" | "overridden" | "rejected"
      shipment_mode: "courier" | "air" | "sea"
      shipment_status:
        | "draft"
        | "figures_approved"
        | "keyed_in_nav"
        | "filed"
        | "mailed"
      shipping_quote_status: "not_requested" | "requested" | "quoted" | "booked"
      stage_event_source: "erp_sync" | "manual"
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
      access_level: ["view", "manage", "admin"],
      app_access_level: ["none", "view", "manage"],
      check_status: ["pending", "approved", "rejected"],
      column_request_status: ["pending", "approved", "added", "declined"],
      courier: ["dhl", "fedex"],
      document_kind: [
        "planning_mail",
        "nav_invoice_mail",
        "po",
        "warehouse_sheet",
        "invoice",
        "buyer_invoice",
        "packing_list",
        "buyer_packing_list",
        "evd",
        "sli",
        "awb",
        "eway_bill",
        "rodtep",
        "import_declaration",
        "other",
      ],
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
      filing_status: ["pending", "approved", "rejected"],
      fuel_type: ["diesel", "ev", "petrol"],
      inbound_document_kind: ["cha_checklist", "bl_draft", "hawb_draft"],
      inbound_mail_status: ["unclaimed", "claimed", "dismissed"],
      journey_status: ["planned", "ongoing", "completed", "cancelled"],
      mail_kind: [
        "pack_to_packing_team",
        "documents_to_merchant",
        "correction_to_cha",
        "correction_to_forwarder",
      ],
      mail_status: ["draft", "approved", "sent", "failed", "rejected"],
      nav011_pull_status: ["pending", "completed", "failed"],
      order_milestone_key: ["qc_done", "packed", "dispatched", "awb_issued"],
      order_request_status: [
        "open",
        "in_progress",
        "blocked",
        "done",
        "rejected",
      ],
      proposal_status: ["pending", "approved", "overridden", "rejected"],
      shipment_mode: ["courier", "air", "sea"],
      shipment_status: [
        "draft",
        "figures_approved",
        "keyed_in_nav",
        "filed",
        "mailed",
      ],
      shipping_quote_status: ["not_requested", "requested", "quoted", "booked"],
      stage_event_source: ["erp_sync", "manual"],
      stop_guest_action: ["pickup", "drop"],
      stop_role: ["origin", "stop", "destination"],
      vehicle_status: ["vacant", "on_trip", "maintenance"],
    },
  },
} as const
