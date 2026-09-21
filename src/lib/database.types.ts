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
      ai_generation_jobs: {
        Row: {
          actual_cost_usd: number
          asset_id: string | null
          attempts: number
          campaign_id: string | null
          created_at: string
          credits_reserved: number
          error: string | null
          estimated_cost_usd: number
          finished_at: string | null
          id: string
          idempotency_key: string
          input: Json
          kind: string
          max_attempts: number
          model: string | null
          output: Json | null
          queued_at: string
          routine_run_id: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          actual_cost_usd?: number
          asset_id?: string | null
          attempts?: number
          campaign_id?: string | null
          created_at?: string
          credits_reserved?: number
          error?: string | null
          estimated_cost_usd?: number
          finished_at?: string | null
          id?: string
          idempotency_key: string
          input?: Json
          kind: string
          max_attempts?: number
          model?: string | null
          output?: Json | null
          queued_at?: string
          routine_run_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          actual_cost_usd?: number
          asset_id?: string | null
          attempts?: number
          campaign_id?: string | null
          created_at?: string
          credits_reserved?: number
          error?: string | null
          estimated_cost_usd?: number
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          input?: Json
          kind?: string
          max_attempts?: number
          model?: string | null
          output?: Json | null
          queued_at?: string
          routine_run_id?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generation_jobs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "creative_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generation_jobs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generation_jobs_routine_run_id_fkey"
            columns: ["routine_run_id"]
            isOneToOne: false
            referencedRelation: "routine_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generation_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_events: {
        Row: {
          cost_usd: number
          created_at: string
          id: string
          images: number
          job_id: string | null
          kind: string
          latency_ms: number
          model: string
          status: string
          tokens_in: number
          tokens_out: number
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          cost_usd?: number
          created_at?: string
          id?: string
          images?: number
          job_id?: string | null
          kind: string
          latency_ms?: number
          model: string
          status?: string
          tokens_in?: number
          tokens_out?: number
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          cost_usd?: number
          created_at?: string
          id?: string
          images?: number
          job_id?: string | null
          kind?: string
          latency_ms?: number
          model?: string
          status?: string
          tokens_in?: number
          tokens_out?: number
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_events_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ai_generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audiences: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          description: string
          desires: string[]
          id: string
          is_primary: boolean
          name: string
          objections: string[]
          pains: string[]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          description?: string
          desires?: string[]
          id?: string
          is_primary?: boolean
          name: string
          objections?: string[]
          pains?: string[]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          desires?: string[]
          id?: string
          is_primary?: boolean
          name?: string
          objections?: string[]
          pains?: string[]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audiences_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audiences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json
          workspace_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json
          workspace_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_profile_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_assets: {
        Row: {
          brand_id: string
          bucket: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          height: number | null
          id: string
          kind: string
          label: string
          mime_type: string
          position: number
          size_bytes: number
          storage_path: string
          width: number | null
          workspace_id: string
        }
        Insert: {
          brand_id: string
          bucket?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          height?: number | null
          id?: string
          kind: string
          label?: string
          mime_type: string
          position?: number
          size_bytes: number
          storage_path: string
          width?: number | null
          workspace_id: string
        }
        Update: {
          brand_id?: string
          bucket?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          height?: number | null
          id?: string
          kind?: string
          label?: string
          mime_type?: string
          position?: number
          size_bytes?: number
          storage_path?: string
          width?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_learnings: {
        Row: {
          brand_id: string
          campaign_id: string | null
          confidence: string
          created_at: string
          created_by: string | null
          evidence: Json
          id: string
          kind: string
          sample_size: number
          statement: string
          workspace_id: string
        }
        Insert: {
          brand_id: string
          campaign_id?: string | null
          confidence?: string
          created_at?: string
          created_by?: string | null
          evidence?: Json
          id?: string
          kind: string
          sample_size?: number
          statement: string
          workspace_id: string
        }
        Update: {
          brand_id?: string
          campaign_id?: string | null
          confidence?: string
          created_at?: string
          created_by?: string | null
          evidence?: Json
          id?: string
          kind?: string
          sample_size?: number
          statement?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_learnings_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_learnings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_learnings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_versions: {
        Row: {
          brand_id: string
          change_summary: string
          created_at: string
          created_by: string | null
          id: string
          snapshot: Json
          workspace_id: string
        }
        Insert: {
          brand_id: string
          change_summary?: string
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot: Json
          workspace_id: string
        }
        Update: {
          brand_id?: string
          change_summary?: string
          created_at?: string
          created_by?: string | null
          id?: string
          snapshot?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_versions_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          cadence: string | null
          channels: string[]
          colors: Json
          competitors: Json
          completeness: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          description: string
          differentiators: string[]
          forbidden_promises: string[]
          forbidden_words: string[]
          formats: string[]
          id: string
          logo_path: string | null
          name: string
          proofs: Json
          recommended_words: string[]
          recurring_offers: Json
          segment: string | null
          typography: Json
          updated_at: string
          voice_notes: string
          voice_tone: string
          website: string | null
          workspace_id: string
        }
        Insert: {
          cadence?: string | null
          channels?: string[]
          colors?: Json
          competitors?: Json
          completeness?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          differentiators?: string[]
          forbidden_promises?: string[]
          forbidden_words?: string[]
          formats?: string[]
          id?: string
          logo_path?: string | null
          name: string
          proofs?: Json
          recommended_words?: string[]
          recurring_offers?: Json
          segment?: string | null
          typography?: Json
          updated_at?: string
          voice_notes?: string
          voice_tone?: string
          website?: string | null
          workspace_id: string
        }
        Update: {
          cadence?: string | null
          channels?: string[]
          colors?: Json
          competitors?: Json
          completeness?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          description?: string
          differentiators?: string[]
          forbidden_promises?: string[]
          forbidden_words?: string[]
          formats?: string[]
          id?: string
          logo_path?: string | null
          name?: string
          proofs?: Json
          recommended_words?: string[]
          recurring_offers?: Json
          segment?: string | null
          typography?: Json
          updated_at?: string
          voice_notes?: string
          voice_tone?: string
          website?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brands_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_briefs: {
        Row: {
          campaign_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          id: string
          payload: Json
          updated_at: string
          version: number
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          payload: Json
          updated_at?: string
          version?: number
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          payload?: Json
          updated_at?: string
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_briefs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_briefs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          brand_id: string
          channel: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          objective: string
          occasion_date: string | null
          origin: string
          routine_id: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id: string
          channel?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          objective?: string
          occasion_date?: string | null
          origin?: string
          routine_id?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string
          channel?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          objective?: string
          occasion_date?: string | null
          origin?: string
          routine_id?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          model: string | null
          payload: Json | null
          role: Database["public"]["Enums"]["message_role"]
          tokens_in: number
          tokens_out: number
          workspace_id: string
        }
        Insert: {
          content?: string
          conversation_id: string
          created_at?: string
          id?: string
          model?: string | null
          payload?: Json | null
          role: Database["public"]["Enums"]["message_role"]
          tokens_in?: number
          tokens_out?: number
          workspace_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          model?: string | null
          payload?: Json | null
          role?: Database["public"]["Enums"]["message_role"]
          tokens_in?: number
          tokens_out?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_messages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          brand_id: string
          campaign_id: string | null
          created_at: string
          created_by: string | null
          id: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          brand_id: string
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          brand_id?: string
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_assets: {
        Row: {
          base_path: string | null
          brand_id: string
          bucket: string
          campaign_id: string | null
          composition: Json
          copy_id: string | null
          cost_usd: number
          created_at: string
          created_by: string | null
          deleted_at: string | null
          direction_id: string | null
          folder_id: string | null
          format: string
          generated_path: string | null
          grupo_id: string | null
          id: string
          is_favorite: boolean
          model: string | null
          rejection_reason: string | null
          render_path: string | null
          status: Database["public"]["Enums"]["creative_status"]
          template_key: string
          updated_at: string
          visual_prompt: string
          workspace_id: string
        }
        Insert: {
          base_path?: string | null
          brand_id: string
          bucket?: string
          campaign_id?: string | null
          composition?: Json
          copy_id?: string | null
          cost_usd?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          direction_id?: string | null
          folder_id?: string | null
          format?: string
          generated_path?: string | null
          grupo_id?: string | null
          id?: string
          is_favorite?: boolean
          model?: string | null
          rejection_reason?: string | null
          render_path?: string | null
          status?: Database["public"]["Enums"]["creative_status"]
          template_key?: string
          updated_at?: string
          visual_prompt?: string
          workspace_id: string
        }
        Update: {
          base_path?: string | null
          brand_id?: string
          bucket?: string
          campaign_id?: string | null
          composition?: Json
          copy_id?: string | null
          cost_usd?: number
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          direction_id?: string | null
          folder_id?: string | null
          format?: string
          generated_path?: string | null
          grupo_id?: string | null
          id?: string
          is_favorite?: boolean
          model?: string | null
          rejection_reason?: string | null
          render_path?: string | null
          status?: Database["public"]["Enums"]["creative_status"]
          template_key?: string
          updated_at?: string
          visual_prompt?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_assets_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_assets_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_assets_copy_id_fkey"
            columns: ["copy_id"]
            isOneToOne: false
            referencedRelation: "creative_copies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_assets_direction_id_fkey"
            columns: ["direction_id"]
            isOneToOne: false
            referencedRelation: "creative_directions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_assets_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_copies: {
        Row: {
          body: string
          bullets: string[]
          campaign_id: string
          created_at: string
          cta: string
          direction_id: string
          formato: string
          headline: string
          id: string
          layout: Json
          mensagens: Json
          opcoes: Json
          pergunta: string
          subheadline: string
          updated_at: string
          variant_index: number
          workspace_id: string
        }
        Insert: {
          body?: string
          bullets?: string[]
          campaign_id: string
          created_at?: string
          cta?: string
          direction_id: string
          formato?: string
          headline?: string
          id?: string
          layout?: Json
          mensagens?: Json
          opcoes?: Json
          pergunta?: string
          subheadline?: string
          updated_at?: string
          variant_index?: number
          workspace_id: string
        }
        Update: {
          body?: string
          bullets?: string[]
          campaign_id?: string
          created_at?: string
          cta?: string
          direction_id?: string
          formato?: string
          headline?: string
          id?: string
          layout?: Json
          mensagens?: Json
          opcoes?: Json
          pergunta?: string
          subheadline?: string
          updated_at?: string
          variant_index?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_copies_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_copies_direction_id_fkey"
            columns: ["direction_id"]
            isOneToOne: false
            referencedRelation: "creative_directions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_copies_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_directions: {
        Row: {
          campaign_id: string
          created_at: string
          cta: string
          hook: string
          hypothesis: string
          id: string
          mechanism: string
          name: string
          objection: string
          position: number
          problem: string
          promise: string
          proof: string
          rationale: string
          rejection_reason: string | null
          status: Database["public"]["Enums"]["direction_status"]
          updated_at: string
          visual_prompt: string
          workspace_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          cta?: string
          hook?: string
          hypothesis?: string
          id?: string
          mechanism?: string
          name: string
          objection?: string
          position?: number
          problem?: string
          promise?: string
          proof?: string
          rationale?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["direction_status"]
          updated_at?: string
          visual_prompt?: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          cta?: string
          hook?: string
          hypothesis?: string
          id?: string
          mechanism?: string
          name?: string
          objection?: string
          position?: number
          problem?: string
          promise?: string
          proof?: string
          rationale?: string
          rejection_reason?: string | null
          status?: Database["public"]["Enums"]["direction_status"]
          updated_at?: string
          visual_prompt?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_directions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_directions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_variants: {
        Row: {
          asset_id: string
          bucket: string
          composition: Json
          created_at: string
          format: string
          id: string
          render_path: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          asset_id: string
          bucket?: string
          composition?: Json
          created_at?: string
          format: string
          id?: string
          render_path?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          asset_id?: string
          bucket?: string
          composition?: Json
          created_at?: string
          format?: string
          id?: string
          render_path?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creative_variants_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "creative_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creative_variants_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          context: Json
          created_at: string
          handled_at: string | null
          handled_by: string | null
          id: string
          kind: string
          message: string
          path: string
          status: string
          user_id: string | null
          workspace_id: string | null
        }
        Insert: {
          context?: Json
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind?: string
          message: string
          path?: string
          status?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Update: {
          context?: Json
          created_at?: string
          handled_at?: string | null
          handled_by?: string | null
          id?: string
          kind?: string
          message?: string
          path?: string
          status?: string
          user_id?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_author_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          parent_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          parent_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      layout_references: {
        Row: {
          ativo: boolean
          created_at: string
          estrutura: string
          id: string
          key: string
          origem: string
          segmento: string
          storage_path: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          estrutura?: string
          id?: string
          key: string
          origem?: string
          segmento: string
          storage_path: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          estrutura?: string
          id?: string
          key?: string
          origem?: string
          segmento?: string
          storage_path?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string | null
          workspace_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id?: string | null
          workspace_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reports: {
        Row: {
          asset_id: string | null
          campaign_id: string
          clicks: number
          created_at: string
          created_by: string | null
          id: string
          impressions: number
          leads: number
          notes: string
          period_end: string
          period_start: string
          purchases: number
          revenue_cents: number
          spend_cents: number
          updated_at: string
          winner_asset_id: string | null
          workspace_id: string
        }
        Insert: {
          asset_id?: string | null
          campaign_id: string
          clicks?: number
          created_at?: string
          created_by?: string | null
          id?: string
          impressions?: number
          leads?: number
          notes?: string
          period_end: string
          period_start: string
          purchases?: number
          revenue_cents?: number
          spend_cents?: number
          updated_at?: string
          winner_asset_id?: string | null
          workspace_id: string
        }
        Update: {
          asset_id?: string | null
          campaign_id?: string
          clicks?: number
          created_at?: string
          created_by?: string | null
          id?: string
          impressions?: number
          leads?: number
          notes?: string
          period_end?: string
          period_start?: string
          purchases?: number
          revenue_cents?: number
          spend_cents?: number
          updated_at?: string
          winner_asset_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "performance_reports_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "creative_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reports_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reports_winner_asset_id_fkey"
            columns: ["winner_asset_id"]
            isOneToOne: false
            referencedRelation: "creative_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "performance_reports_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          auto_routines: boolean
          brands_limit: number
          campaigns_limit: number
          created_at: string
          features: Json
          images_limit: number
          key: Database["public"]["Enums"]["plan_key"]
          members_limit: number
          name: string
        }
        Insert: {
          auto_routines?: boolean
          brands_limit: number
          campaigns_limit: number
          created_at?: string
          features?: Json
          images_limit: number
          key: Database["public"]["Enums"]["plan_key"]
          members_limit: number
          name: string
        }
        Update: {
          auto_routines?: boolean
          brands_limit?: number
          campaigns_limit?: number
          created_at?: string
          features?: Json
          images_limit?: number
          key?: Database["public"]["Enums"]["plan_key"]
          members_limit?: number
          name?: string
        }
        Relationships: []
      }
      product_images: {
        Row: {
          bucket: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          label: string
          position: number
          product_id: string
          storage_path: string
          workspace_id: string
        }
        Insert: {
          bucket?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          label?: string
          position?: number
          product_id: string
          storage_path: string
          workspace_id: string
        }
        Update: {
          bucket?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          label?: string
          position?: number
          product_id?: string
          storage_path?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          currency: string
          deleted_at: string | null
          description: string
          highlights: string[]
          id: string
          image_path: string | null
          is_active: boolean
          name: string
          price_cents: number | null
          updated_at: string
          url: string | null
          workspace_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string
          highlights?: string[]
          id?: string
          image_path?: string | null
          is_active?: boolean
          name: string
          price_cents?: number | null
          updated_at?: string
          url?: string | null
          workspace_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          deleted_at?: string | null
          description?: string
          highlights?: string[]
          id?: string
          image_path?: string | null
          is_active?: boolean
          name?: string
          price_cents?: number | null
          updated_at?: string
          url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          access_status: Database["public"]["Enums"]["access_status"]
          avatar_url: string | null
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          onboarding_completed_at: string | null
          platform_role: Database["public"]["Enums"]["platform_role"]
          updated_at: string
        }
        Insert: {
          access_status?: Database["public"]["Enums"]["access_status"]
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id: string
          onboarding_completed_at?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
        }
        Update: {
          access_status?: Database["public"]["Enums"]["access_status"]
          avatar_url?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocked_reason?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          onboarding_completed_at?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          updated_at?: string
        }
        Relationships: []
      }
      research_responses: {
        Row: {
          created_at: string
          draft_token_hash: string | null
          email: string
          empresa: string
          id: string
          nome: string
          origem: string | null
          respostas: Json
          status: string
          telefone: string
        }
        Insert: {
          created_at?: string
          draft_token_hash?: string | null
          email: string
          empresa: string
          id: string
          nome: string
          origem?: string | null
          respostas: Json
          status?: string
          telefone: string
        }
        Update: {
          created_at?: string
          draft_token_hash?: string | null
          email?: string
          empresa?: string
          id?: string
          nome?: string
          origem?: string | null
          respostas?: Json
          status?: string
          telefone?: string
        }
        Relationships: []
      }
      routine_runs: {
        Row: {
          campaign_id: string | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          idempotency_key: string
          routine_id: string
          scheduled_for: string
          started_at: string | null
          status: Database["public"]["Enums"]["run_status"]
          summary: Json
          trigger: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key: string
          routine_id: string
          scheduled_for: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          summary?: Json
          trigger?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          idempotency_key?: string
          routine_id?: string
          scheduled_for?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["run_status"]
          summary?: Json
          trigger?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routine_runs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_runs_routine_id_fkey"
            columns: ["routine_id"]
            isOneToOne: false
            referencedRelation: "routines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routine_runs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      routines: {
        Row: {
          allow_image_generation: boolean
          auto_generate: boolean
          brand_id: string
          channel: string
          created_at: string
          created_by: string | null
          day_of_month: number | null
          deleted_at: string | null
          formats: string[]
          frequency: Database["public"]["Enums"]["routine_frequency"]
          id: string
          instructions: string
          last_run_at: string | null
          name: string
          next_run_at: string | null
          objective: string
          product_id: string | null
          quantity: number
          recurring_offer: string
          requires_approval: boolean
          run_at: string
          specific_date: string | null
          status: Database["public"]["Enums"]["routine_status"]
          timezone: string
          updated_at: string
          weekday: number | null
          workspace_id: string
        }
        Insert: {
          allow_image_generation?: boolean
          auto_generate?: boolean
          brand_id: string
          channel?: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          deleted_at?: string | null
          formats?: string[]
          frequency?: Database["public"]["Enums"]["routine_frequency"]
          id?: string
          instructions?: string
          last_run_at?: string | null
          name: string
          next_run_at?: string | null
          objective?: string
          product_id?: string | null
          quantity?: number
          recurring_offer?: string
          requires_approval?: boolean
          run_at?: string
          specific_date?: string | null
          status?: Database["public"]["Enums"]["routine_status"]
          timezone?: string
          updated_at?: string
          weekday?: number | null
          workspace_id: string
        }
        Update: {
          allow_image_generation?: boolean
          auto_generate?: boolean
          brand_id?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          day_of_month?: number | null
          deleted_at?: string | null
          formats?: string[]
          frequency?: Database["public"]["Enums"]["routine_frequency"]
          id?: string
          instructions?: string
          last_run_at?: string | null
          name?: string
          next_run_at?: string | null
          objective?: string
          product_id?: string | null
          quantity?: number
          recurring_offer?: string
          requires_approval?: boolean
          run_at?: string
          specific_date?: string | null
          status?: Database["public"]["Enums"]["routine_status"]
          timezone?: string
          updated_at?: string
          weekday?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "routines_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routines_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string
          description: string
          id: string
          is_default: boolean
          key: string
          layout: Json
          name: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          key: string
          layout: Json
          name: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_default?: boolean
          key?: string
          layout?: Json
          name?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_ledger: {
        Row: {
          created_at: string
          created_by: string | null
          delta: number
          id: string
          job_id: string | null
          kind: string
          note: string
          reason: string
          reference_id: string | null
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          job_id?: string | null
          kind: string
          note?: string
          reason: string
          reference_id?: string | null
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          job_id?: string | null
          kind?: string
          note?: string
          reason?: string
          reference_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_ledger_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "ai_generation_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_ledger_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_quotas: {
        Row: {
          bonus_campaigns: number
          bonus_images: number
          campaigns_reserved: number
          campaigns_used: number
          images_reserved: number
          images_used: number
          period_end: string
          period_start: string
          plan: Database["public"]["Enums"]["plan_key"]
          updated_at: string
          workspace_id: string
        }
        Insert: {
          bonus_campaigns?: number
          bonus_images?: number
          campaigns_reserved?: number
          campaigns_used?: number
          images_reserved?: number
          images_used?: number
          period_end?: string
          period_start?: string
          plan?: Database["public"]["Enums"]["plan_key"]
          updated_at?: string
          workspace_id: string
        }
        Update: {
          bonus_campaigns?: number
          bonus_images?: number
          campaigns_reserved?: number
          campaigns_used?: number
          images_reserved?: number
          images_used?: number
          period_end?: string
          period_start?: string
          plan?: Database["public"]["Enums"]["plan_key"]
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_quotas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          created_at: string
          created_by: string | null
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          owner_id: string | null
          plan: Database["public"]["Enums"]["plan_key"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          owner_id?: string | null
          plan?: Database["public"]["Enums"]["plan_key"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          owner_id?: string | null
          plan?: Database["public"]["Enums"]["plan_key"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_account_feedback: {
        Args: { p_workspace: string }
        Returns: {
          criado_em: string
          formato: string
          motivo: string
        }[]
      }
      admin_accounts: {
        Args: never
        Returns: {
          access_status: Database["public"]["Enums"]["access_status"]
          assets_approved: number
          assets_rejected: number
          assets_total: number
          blocked_reason: string
          bonus_images: number
          campaigns_used: number
          email: string
          failed_jobs_7d: number
          full_name: string
          images_limit: number
          images_used: number
          joined_at: string
          last_activity: string
          period_end: string
          plan: Database["public"]["Enums"]["plan_key"]
          platform_role: Database["public"]["Enums"]["platform_role"]
          user_id: string
          workspace_id: string
          workspace_name: string
        }[]
      }
      admin_cost_by_model: {
        Args: { p_days?: number }
        Returns: {
          cost_usd: number
          events: number
          images: number
          model: string
          tokens_in: number
          tokens_out: number
        }[]
      }
      admin_cost_by_workspace: {
        Args: { p_days?: number }
        Returns: {
          cost_usd: number
          events: number
          images: number
          plan: Database["public"]["Enums"]["plan_key"]
          workspace_id: string
          workspace_name: string
        }[]
      }
      apply_storage_rls: { Args: { p_bucket: string }; Returns: undefined }
      apply_workspace_rls: { Args: { p_table: string }; Returns: undefined }
      confirm_credits: {
        Args: {
          p_amount: number
          p_job?: string
          p_kind: string
          p_workspace: string
        }
        Returns: undefined
      }
      ensure_quota_period: {
        Args: { p_workspace: string }
        Returns: {
          bonus_campaigns: number
          bonus_images: number
          campaigns_reserved: number
          campaigns_used: number
          images_reserved: number
          images_used: number
          period_end: string
          period_start: string
          plan: Database["public"]["Enums"]["plan_key"]
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "usage_quotas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_platform_admin: { Args: never; Returns: boolean }
      is_workspace_admin: { Args: { p_workspace: string }; Returns: boolean }
      is_workspace_member: { Args: { p_workspace: string }; Returns: boolean }
      quota_available: {
        Args: { p_kind: string; p_workspace: string }
        Returns: number
      }
      refund_credits: {
        Args: {
          p_amount: number
          p_job?: string
          p_kind: string
          p_note?: string
          p_workspace: string
        }
        Returns: undefined
      }
      reserve_credits: {
        Args: {
          p_amount: number
          p_job?: string
          p_kind: string
          p_workspace: string
        }
        Returns: number
      }
      routine_next_run: {
        Args: {
          p_day_of_month: number
          p_frequency: Database["public"]["Enums"]["routine_frequency"]
          p_from?: string
          p_run_at: string
          p_specific_date: string
          p_timezone: string
          p_weekday: number
        }
        Returns: string
      }
      safe_uuid: { Args: { p_value: string }; Returns: string }
      save_research_response: {
        Args: { p_complete?: boolean; p_draft_token: string; p_payload: Json }
        Returns: string
      }
      set_account_access: {
        Args: {
          p_reason?: string
          p_status: Database["public"]["Enums"]["access_status"]
          p_user: string
        }
        Returns: {
          access_status: Database["public"]["Enums"]["access_status"]
          avatar_url: string | null
          blocked_at: string | null
          blocked_by: string | null
          blocked_reason: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          onboarding_completed_at: string | null
          platform_role: Database["public"]["Enums"]["platform_role"]
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      trigger_run_routines: { Args: never; Returns: undefined }
      workspace_role: {
        Args: { p_workspace: string }
        Returns: Database["public"]["Enums"]["member_role"]
      }
    }
    Enums: {
      access_status: "ativo" | "bloqueado"
      campaign_status:
        | "rascunho"
        | "em_briefing"
        | "briefing_confirmado"
        | "gerando"
        | "revisao"
        | "aprovada"
        | "arquivada"
      creative_status:
        | "rascunho"
        | "gerando"
        | "revisao"
        | "aprovado"
        | "rejeitado"
        | "publicado"
        | "arquivado"
        | "falhou"
      direction_status: "proposta" | "selecionada" | "aprovada" | "rejeitada"
      job_status: "queued" | "processing" | "completed" | "failed" | "cancelled"
      member_role: "owner" | "admin" | "member"
      message_role: "user" | "assistant" | "system"
      plan_key: "beta" | "growth" | "studio"
      platform_role: "user" | "admin"
      routine_frequency: "semanal" | "quinzenal" | "mensal" | "data_especifica"
      routine_status: "ativa" | "pausada" | "erro"
      run_status: "pendente" | "executando" | "concluida" | "falhou" | "pulada"
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
      access_status: ["ativo", "bloqueado"],
      campaign_status: [
        "rascunho",
        "em_briefing",
        "briefing_confirmado",
        "gerando",
        "revisao",
        "aprovada",
        "arquivada",
      ],
      creative_status: [
        "rascunho",
        "gerando",
        "revisao",
        "aprovado",
        "rejeitado",
        "publicado",
        "arquivado",
        "falhou",
      ],
      direction_status: ["proposta", "selecionada", "aprovada", "rejeitada"],
      job_status: ["queued", "processing", "completed", "failed", "cancelled"],
      member_role: ["owner", "admin", "member"],
      message_role: ["user", "assistant", "system"],
      plan_key: ["beta", "growth", "studio"],
      platform_role: ["user", "admin"],
      routine_frequency: ["semanal", "quinzenal", "mensal", "data_especifica"],
      routine_status: ["ativa", "pausada", "erro"],
      run_status: ["pendente", "executando", "concluida", "falhou", "pulada"],
    },
  },
} as const
