export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          profile_picture_url: string | null
          section: string
          year: number
          skills: string[]
          github_url: string | null
          linkedin_url: string | null
          social_visibility: 'always' | 'on_application' | 'hidden'
          gehu_verified: boolean
          gehu_email: string | null
          gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'other' | null
          role: 'student' | 'moderator' | 'super_admin' | 'event_manager' | 'god'
          is_banned: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          email: string
          name: string
          profile_picture_url?: string | null
          section: string
          year: number
          skills?: string[]
          github_url?: string | null
          linkedin_url?: string | null
          social_visibility?: 'always' | 'on_application' | 'hidden'
          gehu_verified?: boolean
          gehu_email?: string | null
          gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'other' | null
          role?: 'student' | 'moderator' | 'super_admin' | 'event_manager' | 'god'
          is_banned?: boolean
        }
        Update: {
          id?: string
          email?: string
          name?: string
          profile_picture_url?: string | null
          section?: string
          year?: number
          skills?: string[]
          github_url?: string | null
          linkedin_url?: string | null
          social_visibility?: 'always' | 'on_application' | 'hidden'
          gehu_verified?: boolean
          gehu_email?: string | null
          gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'other' | null
          role?: 'student' | 'moderator' | 'super_admin' | 'event_manager' | 'god'
          is_banned?: boolean
        }
      }
      teams: {
        Row: {
          id: string
          name: string
          description: string | null
          year: number
          leader_id: string
      purpose: 'hackathon' | 'college_event' | 'pbl' | 'other'
      max_size: number
          is_full: boolean
          member_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          year: number
          leader_id: string
          purpose?: 'hackathon' | 'college_event' | 'pbl' | 'other'
          max_size?: number
          is_full?: boolean
          member_count?: number
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          year?: number
          leader_id?: string
          purpose?: 'hackathon' | 'college_event' | 'pbl' | 'other'
          max_size?: number
          is_full?: boolean
          member_count?: number
        }
      }
      team_members: {
        Row: {
          id: string
          team_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          id?: string
          team_id: string
          user_id: string
        }
        Update: {
          id?: string
          team_id?: string
          user_id?: string
        }
      }
      team_join_requests: {
        Row: {
          id: string
          team_id: string
          requester_id: string
          status: 'pending' | 'approved' | 'rejected'
          message: string | null
          created_at: string
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          team_id: string
          requester_id: string
          status?: 'pending' | 'approved' | 'rejected'
          message?: string | null
        }
        Update: {
          id?: string
          team_id?: string
          requester_id?: string
          status?: 'pending' | 'approved' | 'rejected'
          message?: string | null
          reviewed_at?: string | null
        }
      }
      recruitment_posts: {
        Row: {
          id: string
          team_id: string
          posted_by: string
          title: string
          description: string
          required_skills: string[]
          positions_available: number
          preferred_gender: 'male' | 'female' | 'any'
          expires_at: string
          status: 'open' | 'closed' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          team_id: string
          posted_by: string
          title: string
          description: string
          required_skills?: string[]
          positions_available?: number
          preferred_gender?: 'male' | 'female' | 'any'
          expires_at?: string
          status?: 'open' | 'closed' | 'archived'
        }
        Update: {
          id?: string
          team_id?: string
          posted_by?: string
          title?: string
          description?: string
          required_skills?: string[]
          positions_available?: number
          preferred_gender?: 'male' | 'female' | 'any'
          expires_at?: string
          status?: 'open' | 'closed' | 'archived'
        }
      }
      applications: {
        Row: {
          id: string
          recruitment_post_id: string
          applicant_id: string
          message: string | null
          status: 'pending' | 'accepted' | 'rejected'
          applied_at: string
          reviewed_at: string | null
        }
        Insert: {
          id?: string
          recruitment_post_id: string
          applicant_id: string
          message?: string | null
          status?: 'pending' | 'accepted' | 'rejected'
        }
        Update: {
          id?: string
          recruitment_post_id?: string
          applicant_id?: string
          message?: string | null
          status?: 'pending' | 'accepted' | 'rejected'
          reviewed_at?: string | null
        }
      }
      events: {
        Row: {
          id: string
          title: string
          slug: string | null
          summary: string | null
          description: string | null
          event_type: 'hackathon' | 'workshop' | 'seminar' | 'competition' | 'meetup' | 'other'
          event_mode: 'in_person' | 'online' | 'hybrid'
          visibility: 'public' | 'campus'
          banner_url: string | null
          start_at: string
          end_at: string
          location: string | null
          meeting_link: string | null
          registration_type: 'registration_required' | 'open'
          registration_flow: 'auto_approval' | 'form_review'
          registration_opens_at: string | null
          registration_closes_at: string | null
          max_participants: number | null
          requires_gehu_verification: boolean
          allow_waitlist: boolean
          auto_close: boolean
          status: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
          published_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug?: string | null
          summary?: string | null
          description?: string | null
          event_type?: 'hackathon' | 'workshop' | 'seminar' | 'competition' | 'meetup' | 'other'
          event_mode?: 'in_person' | 'online' | 'hybrid'
          visibility?: 'public' | 'campus'
          banner_url?: string | null
          start_at: string
          end_at: string
          location?: string | null
          meeting_link?: string | null
          registration_type?: 'registration_required' | 'open'
          registration_flow?: 'auto_approval' | 'form_review'
          registration_opens_at?: string | null
          registration_closes_at?: string | null
          max_participants?: number | null
          requires_gehu_verification?: boolean
          allow_waitlist?: boolean
          auto_close?: boolean
          status?: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
          published_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string | null
          summary?: string | null
          description?: string | null
          event_type?: 'hackathon' | 'workshop' | 'seminar' | 'competition' | 'meetup' | 'other'
          event_mode?: 'in_person' | 'online' | 'hybrid'
          visibility?: 'public' | 'campus'
          banner_url?: string | null
          start_at?: string
          end_at?: string
          location?: string | null
          meeting_link?: string | null
          registration_type?: 'registration_required' | 'open'
          registration_flow?: 'auto_approval' | 'form_review'
          registration_opens_at?: string | null
          registration_closes_at?: string | null
          max_participants?: number | null
          requires_gehu_verification?: boolean
          allow_waitlist?: boolean
          auto_close?: boolean
          status?: 'draft' | 'scheduled' | 'live' | 'ended' | 'cancelled'
          published_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      event_forms: {
        Row: {
          id: string
          event_id: string
          title: string
          description: string | null
          form_schema: Json
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          title?: string
          description?: string | null
          form_schema: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          title?: string
          description?: string | null
          form_schema?: Json
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      event_registrations: {
        Row: {
          id: string
          event_id: string
          user_id: string
          status: 'pending' | 'approved' | 'waitlisted' | 'rejected' | 'cancelled'
          answers: Json | null
          submitted_at: string
          reviewed_at: string | null
          reviewed_by: string | null
          cancellation_reason: string | null
          waitlist_position: number | null
        }
        Insert: {
          id?: string
          event_id: string
          user_id: string
          status?: 'pending' | 'approved' | 'waitlisted' | 'rejected' | 'cancelled'
          answers?: Json | null
          submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          cancellation_reason?: string | null
          waitlist_position?: number | null
        }
        Update: {
          id?: string
          event_id?: string
          user_id?: string
          status?: 'pending' | 'approved' | 'waitlisted' | 'rejected' | 'cancelled'
          answers?: Json | null
          submitted_at?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          cancellation_reason?: string | null
          waitlist_position?: number | null
        }
      }
      event_polls: {
        Row: {
          id: string
          event_id: string
          question: string
          description: string | null
          mode: 'single_choice' | 'multiple_choice'
          is_anonymous: boolean
          is_published: boolean
          opens_at: string | null
          closes_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          question: string
          description?: string | null
          mode?: 'single_choice' | 'multiple_choice'
          is_anonymous?: boolean
          is_published?: boolean
          opens_at?: string | null
          closes_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          question?: string
          description?: string | null
          mode?: 'single_choice' | 'multiple_choice'
          is_anonymous?: boolean
          is_published?: boolean
          opens_at?: string | null
          closes_at?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      event_poll_options: {
        Row: {
          id: string
          poll_id: string
          label: string
          description: string | null
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          poll_id: string
          label: string
          description?: string | null
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          poll_id?: string
          label?: string
          description?: string | null
          sort_order?: number
          created_at?: string
        }
      }
      event_poll_votes: {
        Row: {
          id: string
          poll_id: string
          option_id: string
          user_id: string
          voted_at: string
        }
        Insert: {
          id?: string
          poll_id: string
          option_id: string
          user_id: string
          voted_at?: string
        }
        Update: {
          id?: string
          poll_id?: string
          option_id?: string
          user_id?: string
          voted_at?: string
        }
      }
      chatrooms: {
        Row: {
          id: string
          type: 'dm' | 'team' | 'recruitment' | 'group'
          team_id: string | null
          recruitment_post_id: string | null
          name: string | null
          created_at: string
          archived: boolean
        }
        Insert: {
          id?: string
          type: 'dm' | 'team' | 'recruitment' | 'group'
          team_id?: string | null
          recruitment_post_id?: string | null
          name?: string | null
          archived?: boolean
        }
        Update: {
          id?: string
          type?: 'dm' | 'team' | 'recruitment' | 'group'
          team_id?: string | null
          recruitment_post_id?: string | null
          name?: string | null
          archived?: boolean
        }
      }
      chatroom_members: {
        Row: {
          id: string
          chatroom_id: string
          user_id: string
          joined_at: string
          last_read_at: string
        }
        Insert: {
          id?: string
          chatroom_id: string
          user_id: string
          last_read_at?: string
        }
        Update: {
          id?: string
          chatroom_id?: string
          user_id?: string
          last_read_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          chatroom_id: string
          sender_id: string
          content: string
          created_at: string
          edited_at: string | null
          deleted: boolean
          reply_to_message_id: string | null
          forwarded_from_message_id: string | null
        }
        Insert: {
          id?: string
          chatroom_id: string
          sender_id: string
          content: string
          deleted?: boolean
          reply_to_message_id?: string | null
          forwarded_from_message_id?: string | null
        }
        Update: {
          id?: string
          chatroom_id?: string
          sender_id?: string
          content?: string
          edited_at?: string | null
          deleted?: boolean
          reply_to_message_id?: string | null
          forwarded_from_message_id?: string | null
        }
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: 'application' | 'team_invite' | 'message' | 'system' | 'event'
          title: string
          message: string
          link: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: 'application' | 'team_invite' | 'message' | 'system' | 'event'
          title: string
          message: string
          link?: string | null
          read?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          type?: 'application' | 'team_invite' | 'message' | 'system' | 'event'
          title?: string
          message?: string
          link?: string | null
          read?: boolean
        }
      }
      verification_otps: {
        Row: {
          id: string
          user_id: string
          email: string
          otp: string
          expires_at: string
          verified: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          email: string
          otp: string
          expires_at: string
          verified?: boolean
        }
        Update: {
          id?: string
          user_id?: string
          email?: string
          otp?: string
          expires_at?: string
          verified?: boolean
        }
      }
      contacts: {
        Row: {
          id: string
          owner_id: string
          contact_id: string
          alias: string | null
          favorite: boolean
          created_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          contact_id: string
          alias?: string | null
          favorite?: boolean
        }
        Update: {
          id?: string
          owner_id?: string
          contact_id?: string
          alias?: string | null
          favorite?: boolean
        }
      }
      friend_requests: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          status: 'pending' | 'accepted' | 'declined' | 'blocked'
          message: string | null
          created_at: string
          responded_at: string | null
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          status?: 'pending' | 'accepted' | 'declined' | 'blocked'
          message?: string | null
          responded_at?: string | null
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          status?: 'pending' | 'accepted' | 'declined' | 'blocked'
          message?: string | null
          created_at?: string
          responded_at?: string | null
        }
      }
      chatroom_roles: {
        Row: {
          id: string
          chatroom_id: string
          user_id: string
          role: 'owner' | 'admin' | 'moderator' | 'member'
          can_post: boolean
          can_manage_members: boolean
          can_manage_messages: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          chatroom_id: string
          user_id: string
          role?: 'owner' | 'admin' | 'moderator' | 'member'
          can_post?: boolean
          can_manage_members?: boolean
          can_manage_messages?: boolean
        }
        Update: {
          id?: string
          chatroom_id?: string
          user_id?: string
          role?: 'owner' | 'admin' | 'moderator' | 'member'
          can_post?: boolean
          can_manage_members?: boolean
          can_manage_messages?: boolean
        }
      }
      chatroom_mutes: {
        Row: {
          id: string
          chatroom_id: string
          user_id: string
          muted_until: string | null
          reason: string | null
          created_by: string
          created_at: string
        }
        Insert: {
          id?: string
          chatroom_id: string
          user_id: string
          muted_until?: string | null
          reason?: string | null
          created_by: string
        }
        Update: {
          id?: string
          chatroom_id?: string
          user_id?: string
          muted_until?: string | null
          reason?: string | null
          created_by?: string
        }
      }
      message_reactions: {
        Row: {
          id: string
          message_id: string
          user_id: string
          reaction: string
          created_at: string
        }
        Insert: {
          id?: string
          message_id: string
          user_id: string
          reaction: string
        }
        Update: {
          id?: string
          message_id?: string
          user_id?: string
          reaction?: string
        }
      }
      system_settings: {
        Row: {
          key: string
          category: string
          description: string | null
          value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          category?: string
          description?: string | null
          value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          key?: string
          category?: string
          description?: string | null
          value?: Json
          updated_at?: string
          updated_by?: string | null
        }
      }
      message_reports: {
        Row: {
          id: string
          message_id: string
          reporter_id: string
          reason: string
          created_at: string
          status: 'pending' | 'reviewing' | 'resolved'
          reviewer_id: string | null
          reviewed_at: string | null
          decrypted_preview: string | null
        }
        Insert: {
          id?: string
          message_id: string
          reporter_id: string
          reason: string
          status?: 'pending' | 'reviewing' | 'resolved'
          reviewer_id?: string | null
          reviewed_at?: string | null
          decrypted_preview?: string | null
        }
        Update: {
          id?: string
          message_id?: string
          reporter_id?: string
          reason?: string
          status?: 'pending' | 'reviewing' | 'resolved'
          reviewer_id?: string | null
          reviewed_at?: string | null
          decrypted_preview?: string | null
        }
      }
      support_tickets: {
        Row: {
          id: string
          user_id: string
          subject: string
          description: string
          status: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          assigned_admin_id: string | null
          created_at: string
          updated_at: string
          resolved_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          subject: string
          description: string
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          assigned_admin_id?: string | null
          resolved_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          subject?: string
          description?: string
          status?: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority?: 'low' | 'medium' | 'high' | 'urgent'
          assigned_admin_id?: string | null
          resolved_at?: string | null
        }
      }
      ticket_messages: {
        Row: {
          id: string
          ticket_id: string
          sender_id: string
          content: string
          is_admin_reply: boolean
          created_at: string
        }
        Insert: {
          id?: string
          ticket_id: string
          sender_id: string
          content: string
          is_admin_reply?: boolean
        }
        Update: {
          id?: string
          ticket_id?: string
          sender_id?: string
          content?: string
          is_admin_reply?: boolean
        }
      }
      team_invitations: {
        Row: {
          id: string
          team_id: string
          invited_by: string
          invited_user_id: string | null
          invited_email: string | null
          role: string
          message: string | null
          status: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled'
          created_at: string
          expires_at: string
          responded_at: string | null
          invite_token: string
        }
        Insert: {
          id?: string
          team_id: string
          invited_by: string
          invited_user_id?: string | null
          invited_email?: string | null
          role?: string
          message?: string | null
          status?: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled'
          expires_at?: string
          invite_token?: string
        }
        Update: {
          id?: string
          team_id?: string
          invited_by?: string
          invited_user_id?: string | null
          invited_email?: string | null
          role?: string
          message?: string | null
          status?: 'pending' | 'accepted' | 'declined' | 'expired' | 'cancelled'
          responded_at?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: {
      create_notification: {
        Args: Record<string, unknown>
        Returns: null
      }
      delete_user_account: {
        Args: Record<string, never>
        Returns: null
      }
      schedule_account_deactivation: {
        Args: Record<string, never>
        Returns: null
      }
      get_user_tickets: {
        Args: { p_user_id: string }
        Returns: {
          id: string
          subject: string
          description: string
          status: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          created_at: string
          updated_at: string
          message_count: number
          last_message_at: string | null
        }[]
      }
      get_all_tickets: {
        Args: Record<string, never>
        Returns: {
          id: string
          user_id: string
          user_name: string
          user_email: string
          subject: string
          status: 'open' | 'in_progress' | 'resolved' | 'closed'
          priority: 'low' | 'medium' | 'high' | 'urgent'
          created_at: string
          updated_at: string
          message_count: number
          assigned_admin_name: string | null
        }[]
      }
      accept_team_invitation: {
        Args: { invitation_id: string }
        Returns: Json
      }
      decline_team_invitation: {
        Args: { invitation_id: string }
        Returns: Json
      }
      cancel_team_invitation: {
        Args: { invitation_id: string }
        Returns: Json
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type TablesName = keyof Database['public']['Tables']
export type TableRow<T extends TablesName> = Database['public']['Tables'][T]['Row']
export type TableInsert<T extends TablesName> = Database['public']['Tables'][T]['Insert']
export type TableUpdate<T extends TablesName> = Database['public']['Tables'][T]['Update']
