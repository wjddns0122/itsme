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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      facilities: {
        Row: {
          address: string | null
          areas: string[]
          contact_phone: string | null
          created_at: string
          desk_location: string | null
          homepage_url: string | null
          hours: string | null
          id: string
          intro: string | null
          is_listed: boolean
          name: string
          pickup_guide: string | null
          region: string | null
          slug: string
          transfer_days: number
          type: Database["public"]["Enums"]["facility_type"]
        }
        Insert: {
          address?: string | null
          areas?: string[]
          contact_phone?: string | null
          created_at?: string
          desk_location?: string | null
          homepage_url?: string | null
          hours?: string | null
          id?: string
          intro?: string | null
          is_listed?: boolean
          name: string
          pickup_guide?: string | null
          region?: string | null
          slug: string
          transfer_days?: number
          type?: Database["public"]["Enums"]["facility_type"]
        }
        Update: {
          address?: string | null
          areas?: string[]
          contact_phone?: string | null
          created_at?: string
          desk_location?: string | null
          homepage_url?: string | null
          hours?: string | null
          id?: string
          intro?: string | null
          is_listed?: boolean
          name?: string
          pickup_guide?: string | null
          region?: string | null
          slug?: string
          transfer_days?: number
          type?: Database["public"]["Enums"]["facility_type"]
        }
        Relationships: []
      }
      facility_members: {
        Row: {
          facility_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          facility_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          facility_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "facility_members_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      found_items: {
        Row: {
          ai_confidence: number | null
          ai_latency_ms: number | null
          ai_model: string | null
          ai_raw: Json | null
          ai_status: Database["public"]["Enums"]["ai_status"]
          brand: string | null
          category: string
          colors: string[]
          created_at: string
          created_by: string | null
          facility_id: string
          features: string[]
          found_area: string | null
          found_at: string
          id: string
          is_sensitive: boolean
          material: string | null
          photo_paths: string[]
          private_features: string[]
          public_summary: string
          register_started_at: string | null
          return_method: string | null
          return_note: string | null
          returned_at: string | null
          returned_to_name: string | null
          review_needed: boolean
          search_text: string | null
          status: Database["public"]["Enums"]["found_status"]
          storage_location: string | null
          subcategory: string | null
          transfer_due_at: string | null
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          ai_latency_ms?: number | null
          ai_model?: string | null
          ai_raw?: Json | null
          ai_status?: Database["public"]["Enums"]["ai_status"]
          brand?: string | null
          category: string
          colors?: string[]
          created_at?: string
          created_by?: string | null
          facility_id: string
          features?: string[]
          found_area?: string | null
          found_at: string
          id?: string
          is_sensitive?: boolean
          material?: string | null
          photo_paths?: string[]
          private_features?: string[]
          public_summary: string
          register_started_at?: string | null
          return_method?: string | null
          return_note?: string | null
          returned_at?: string | null
          returned_to_name?: string | null
          review_needed?: boolean
          search_text?: string | null
          status?: Database["public"]["Enums"]["found_status"]
          storage_location?: string | null
          subcategory?: string | null
          transfer_due_at?: string | null
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          ai_latency_ms?: number | null
          ai_model?: string | null
          ai_raw?: Json | null
          ai_status?: Database["public"]["Enums"]["ai_status"]
          brand?: string | null
          category?: string
          colors?: string[]
          created_at?: string
          created_by?: string | null
          facility_id?: string
          features?: string[]
          found_area?: string | null
          found_at?: string
          id?: string
          is_sensitive?: boolean
          material?: string | null
          photo_paths?: string[]
          private_features?: string[]
          public_summary?: string
          register_started_at?: string | null
          return_method?: string | null
          return_note?: string | null
          returned_at?: string | null
          returned_to_name?: string | null
          review_needed?: boolean
          search_text?: string | null
          status?: Database["public"]["Enums"]["found_status"]
          storage_location?: string | null
          subcategory?: string | null
          transfer_due_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "found_items_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          channel: Database["public"]["Enums"]["inquiry_channel"]
          contact_key: string | null
          created_at: string
          facility_id: string
          handled_by: string | null
          id: string
          lost_report_id: string | null
          note: string | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["inquiry_channel"]
          contact_key?: string | null
          created_at?: string
          facility_id: string
          handled_by?: string | null
          id?: string
          lost_report_id?: string | null
          note?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["inquiry_channel"]
          contact_key?: string | null
          created_at?: string
          facility_id?: string
          handled_by?: string | null
          id?: string
          lost_report_id?: string | null
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inquiries_lost_report_id_fkey"
            columns: ["lost_report_id"]
            isOneToOne: false
            referencedRelation: "lost_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      item_events: {
        Row: {
          actor: string | null
          created_at: string
          facility_id: string
          found_item_id: string | null
          id: number
          lost_report_id: string | null
          payload: Json
          type: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          facility_id: string
          found_item_id?: string | null
          id?: never
          lost_report_id?: string | null
          payload?: Json
          type: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          facility_id?: string
          found_item_id?: string | null
          id?: never
          lost_report_id?: string | null
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_events_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_events_found_item_id_fkey"
            columns: ["found_item_id"]
            isOneToOne: false
            referencedRelation: "found_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_events_lost_report_id_fkey"
            columns: ["lost_report_id"]
            isOneToOne: false
            referencedRelation: "lost_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_reports: {
        Row: {
          access_token: string
          ai_confidence: number | null
          ai_raw: Json | null
          ai_status: Database["public"]["Enums"]["ai_status"]
          brand: string | null
          category: string | null
          closed_at: string | null
          colors: string[]
          consent_at: string
          contact_email: string | null
          contact_key: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          created_by: string | null
          created_via: string
          description: string
          facility_id: string
          features: string[]
          id: string
          is_rental: boolean
          language: string
          lost_area: string | null
          lost_from: string
          lost_time_of_day: string | null
          lost_to: string
          report_photo_paths: string[]
          report_started_at: string | null
          search_text: string | null
          secret_detail: string | null
          status: Database["public"]["Enums"]["report_status"]
          subcategory: string | null
          user_category: string | null
        }
        Insert: {
          access_token: string
          ai_confidence?: number | null
          ai_raw?: Json | null
          ai_status?: Database["public"]["Enums"]["ai_status"]
          brand?: string | null
          category?: string | null
          closed_at?: string | null
          colors?: string[]
          consent_at: string
          contact_email?: string | null
          contact_key?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          description: string
          facility_id: string
          features?: string[]
          id?: string
          is_rental?: boolean
          language?: string
          lost_area?: string | null
          lost_from: string
          lost_time_of_day?: string | null
          lost_to: string
          report_photo_paths?: string[]
          report_started_at?: string | null
          search_text?: string | null
          secret_detail?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          subcategory?: string | null
          user_category?: string | null
        }
        Update: {
          access_token?: string
          ai_confidence?: number | null
          ai_raw?: Json | null
          ai_status?: Database["public"]["Enums"]["ai_status"]
          brand?: string | null
          category?: string | null
          closed_at?: string | null
          colors?: string[]
          consent_at?: string
          contact_email?: string | null
          contact_key?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          created_by?: string | null
          created_via?: string
          description?: string
          facility_id?: string
          features?: string[]
          id?: string
          is_rental?: boolean
          language?: string
          lost_area?: string | null
          lost_from?: string
          lost_time_of_day?: string | null
          lost_to?: string
          report_photo_paths?: string[]
          report_started_at?: string | null
          search_text?: string | null
          secret_detail?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          subcategory?: string | null
          user_category?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lost_reports_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      match_candidates: {
        Row: {
          ai_verdict: Json | null
          breakdown: Json
          claim_answers: Json | null
          claim_attempt: number
          claim_photo_path: string | null
          claimed_at: string | null
          coverage: number
          created_at: string
          facility_id: string
          found_item_id: string
          id: string
          lost_report_id: string
          notified_at: string | null
          pickup_message: string | null
          proof_photo_path: string | null
          proof_reply: string | null
          proof_request: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          score: number
          status: Database["public"]["Enums"]["candidate_status"]
          updated_at: string
        }
        Insert: {
          ai_verdict?: Json | null
          breakdown: Json
          claim_answers?: Json | null
          claim_attempt?: number
          claim_photo_path?: string | null
          claimed_at?: string | null
          coverage?: number
          created_at?: string
          facility_id: string
          found_item_id: string
          id?: string
          lost_report_id: string
          notified_at?: string | null
          pickup_message?: string | null
          proof_photo_path?: string | null
          proof_reply?: string | null
          proof_request?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score: number
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
        }
        Update: {
          ai_verdict?: Json | null
          breakdown?: Json
          claim_answers?: Json | null
          claim_attempt?: number
          claim_photo_path?: string | null
          claimed_at?: string | null
          coverage?: number
          created_at?: string
          facility_id?: string
          found_item_id?: string
          id?: string
          lost_report_id?: string
          notified_at?: string | null
          pickup_message?: string | null
          proof_photo_path?: string | null
          proof_reply?: string | null
          proof_request?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          score?: number
          status?: Database["public"]["Enums"]["candidate_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_candidates_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "facilities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_candidates_found_item_id_fkey"
            columns: ["found_item_id"]
            isOneToOne: false
            referencedRelation: "found_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_candidates_lost_report_id_fkey"
            columns: ["lost_report_id"]
            isOneToOne: false
            referencedRelation: "lost_reports"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cancel_lost_report: { Args: { p_report_id: string }; Returns: boolean }
      candidate_items_for_report: {
        Args: { p_limit?: number; p_report_id: string }
        Returns: {
          ai_confidence: number
          brand: string
          category: string
          colors: string[]
          found_area: string
          found_at: string
          found_date: string
          found_item_id: string
          search_text: string
        }[]
      }
      candidate_reports_for_item: {
        Args: { p_item_id: string; p_limit?: number }
        Returns: {
          ai_confidence: number
          brand: string
          category: string
          colors: string[]
          lost_area: string
          lost_from: string
          lost_report_id: string
          lost_time_of_day: string
          lost_to: string
          search_text: string
        }[]
      }
      dismiss_candidate_by_reporter: {
        Args: { p_candidate_id: string; p_report_id: string }
        Returns: boolean
      }
      mark_returned: {
        Args: {
          p_candidate_id: string
          p_item_id: string
          p_method: string
          p_note?: string
          p_recipient: string
        }
        Returns: undefined
      }
      review_claim: {
        Args: {
          p_action: string
          p_candidate_id: string
          p_message?: string
          p_note?: string
        }
        Returns: undefined
      }
      search_facilities: {
        Args: {
          p_limit?: number
          p_query: string
          p_type?: Database["public"]["Enums"]["facility_type"]
        }
        Returns: {
          name: string
          region: string
          slug: string
          type: Database["public"]["Enums"]["facility_type"]
        }[]
      }
      search_items: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          ai_confidence: number | null
          ai_latency_ms: number | null
          ai_model: string | null
          ai_raw: Json | null
          ai_status: Database["public"]["Enums"]["ai_status"]
          brand: string | null
          category: string
          colors: string[]
          created_at: string
          created_by: string | null
          facility_id: string
          features: string[]
          found_area: string | null
          found_at: string
          id: string
          is_sensitive: boolean
          material: string | null
          photo_paths: string[]
          private_features: string[]
          public_summary: string
          register_started_at: string | null
          return_method: string | null
          return_note: string | null
          returned_at: string | null
          returned_to_name: string | null
          review_needed: boolean
          search_text: string | null
          status: Database["public"]["Enums"]["found_status"]
          storage_location: string | null
          subcategory: string | null
          transfer_due_at: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "found_items"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      set_found_item_status: {
        Args: {
          p_item_id: string
          p_note?: string
          p_status: Database["public"]["Enums"]["found_status"]
        }
        Returns: undefined
      }
      submit_claim: {
        Args: {
          p_answers: Json
          p_candidate_id: string
          p_photo_path: string
          p_report_id: string
        }
        Returns: string
      }
      submit_proof: {
        Args: {
          p_candidate_id: string
          p_photo_path: string
          p_reply: string
          p_report_id: string
        }
        Returns: string
      }
    }
    Enums: {
      ai_status: "pending" | "done" | "failed" | "skipped"
      candidate_status:
        | "suggested"
        | "claimed"
        | "needs_proof"
        | "approved"
        | "rejected"
        | "dismissed"
      facility_type:
        | "school"
        | "ski_resort"
        | "hotel"
        | "festival"
        | "cafe"
        | "other"
      found_status:
        | "stored"
        | "claimed"
        | "returned"
        | "transferred"
        | "disposed"
      inquiry_channel: "phone" | "visit" | "message" | "other"
      member_role: "owner" | "staff"
      report_status: "open" | "claimed" | "resolved" | "closed"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      ai_status: ["pending", "done", "failed", "skipped"],
      candidate_status: [
        "suggested",
        "claimed",
        "needs_proof",
        "approved",
        "rejected",
        "dismissed",
      ],
      facility_type: [
        "school",
        "ski_resort",
        "hotel",
        "festival",
        "cafe",
        "other",
      ],
      found_status: [
        "stored",
        "claimed",
        "returned",
        "transferred",
        "disposed",
      ],
      inquiry_channel: ["phone", "visit", "message", "other"],
      member_role: ["owner", "staff"],
      report_status: ["open", "claimed", "resolved", "closed"],
    },
  },
} as const
