-- ============================================================
-- LINK-UP COMPLETE DATABASE SCHEMA
-- Run this file in Supabase SQL Editor
-- Generated: 2026-01-19
-- ============================================================
-- This file consolidates ALL schema changes including:
-- 1. Support Tickets System
-- 2. Team Invitations System  
-- 3. System Settings with RLS
-- 4. Message Reactions
-- 5. Message Reports
-- 6. All necessary indexes and functions
-- ============================================================

-- ========================
-- EXTENSIONS (ensure these are enabled)
-- ========================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ========================
-- ENUMS
-- ========================

-- Ticket status enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status_enum') THEN
    CREATE TYPE ticket_status_enum AS ENUM ('open', 'in_progress', 'resolved', 'closed');
  END IF;
END $$;

-- Ticket priority enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority_enum') THEN
    CREATE TYPE ticket_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;
END $$;

-- Invitation status enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status_enum') THEN
    CREATE TYPE invitation_status_enum AS ENUM ('pending', 'accepted', 'declined', 'expired', 'cancelled');
  END IF;
END $$;

-- ========================
-- HELPER FUNCTIONS
-- ========================

-- Check if user is god or super_admin
CREATE OR REPLACE FUNCTION is_god_or_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = user_id
    AND role IN ('god', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user is team leader or co_leader
CREATE OR REPLACE FUNCTION is_team_leader_or_coleader(p_team_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
    AND role IN ('leader', 'co_leader')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================
-- 1. SUPPORT TICKETS SYSTEM
-- ============================================================

-- Support Tickets Table
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status ticket_status_enum DEFAULT 'open',
  priority ticket_priority_enum DEFAULT 'medium',
  assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- Ticket Messages Table (for ticket chat)
CREATE TABLE IF NOT EXISTS ticket_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_admin_reply BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_id ON ticket_messages(sender_id);

-- Update timestamp trigger for tickets
CREATE OR REPLACE FUNCTION update_ticket_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_ticket_timestamp ON support_tickets;
CREATE TRIGGER trigger_update_ticket_timestamp
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_ticket_timestamp();

-- Enable RLS on tickets
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can update own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can update any ticket" ON support_tickets;
DROP POLICY IF EXISTS "Users can view messages on own tickets" ON ticket_messages;
DROP POLICY IF EXISTS "Admins can view all ticket messages" ON ticket_messages;
DROP POLICY IF EXISTS "Users can send messages on own tickets" ON ticket_messages;
DROP POLICY IF EXISTS "Admins can send messages on any ticket" ON ticket_messages;

-- Support Tickets Policies
CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all tickets"
  ON support_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'moderator', 'god')
    )
  );

CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tickets"
  ON support_tickets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any ticket"
  ON support_tickets FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'moderator', 'god')
    )
  );

-- Ticket Messages Policies
CREATE POLICY "Users can view messages on own tickets"
  ON ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE id = ticket_messages.ticket_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all ticket messages"
  ON ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'moderator', 'god')
    )
  );

CREATE POLICY "Users can send messages on own tickets"
  ON ticket_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM support_tickets
      WHERE id = ticket_messages.ticket_id
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can send messages on any ticket"
  ON ticket_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'moderator', 'god')
    )
  );

-- RPC function to get tickets for a user
CREATE OR REPLACE FUNCTION get_user_tickets(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  subject VARCHAR(255),
  description TEXT,
  status ticket_status_enum,
  priority ticket_priority_enum,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  message_count BIGINT,
  last_message_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.subject,
    t.description,
    t.status,
    t.priority,
    t.created_at,
    t.updated_at,
    COUNT(m.id) AS message_count,
    MAX(m.created_at) AS last_message_at
  FROM support_tickets t
  LEFT JOIN ticket_messages m ON t.id = m.ticket_id
  WHERE t.user_id = p_user_id
  GROUP BY t.id
  ORDER BY t.updated_at DESC;
END;
$$;

-- RPC function for admins to get all tickets
CREATE OR REPLACE FUNCTION get_all_tickets()
RETURNS TABLE (
  id UUID,
  user_id UUID,
  user_name TEXT,
  user_email TEXT,
  subject VARCHAR(255),
  status ticket_status_enum,
  priority ticket_priority_enum,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  message_count BIGINT,
  assigned_admin_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('super_admin', 'moderator', 'god')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT 
    t.id,
    t.user_id,
    u.name AS user_name,
    u.email AS user_email,
    t.subject,
    t.status,
    t.priority,
    t.created_at,
    t.updated_at,
    COUNT(m.id) AS message_count,
    a.name AS assigned_admin_name
  FROM support_tickets t
  JOIN users u ON t.user_id = u.id
  LEFT JOIN users a ON t.assigned_admin_id = a.id
  LEFT JOIN ticket_messages m ON t.id = m.ticket_id
  GROUP BY t.id, u.name, u.email, a.name
  ORDER BY 
    CASE t.status 
      WHEN 'open' THEN 1 
      WHEN 'in_progress' THEN 2 
      WHEN 'resolved' THEN 3 
      WHEN 'closed' THEN 4 
    END,
    t.updated_at DESC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_user_tickets(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_tickets() TO authenticated;

-- ============================================================
-- 2. SYSTEM SETTINGS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "system_settings_select" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_insert" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_update" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_delete" ON public.system_settings;

-- SELECT: All authenticated users can read
CREATE POLICY "system_settings_select"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT: Only god/super_admin
CREATE POLICY "system_settings_insert"
  ON public.system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_god_or_super_admin(auth.uid()));

-- UPDATE: Only god/super_admin
CREATE POLICY "system_settings_update"
  ON public.system_settings
  FOR UPDATE
  TO authenticated
  USING (is_god_or_super_admin(auth.uid()))
  WITH CHECK (is_god_or_super_admin(auth.uid()));

-- DELETE: Only god/super_admin
CREATE POLICY "system_settings_delete"
  ON public.system_settings
  FOR DELETE
  TO authenticated
  USING (is_god_or_super_admin(auth.uid()));

-- Index for category lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON public.system_settings(category);

-- Audit table for system settings
CREATE TABLE IF NOT EXISTS public.system_settings_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  action TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_settings_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_admin_only" ON public.system_settings_audit;
CREATE POLICY "audit_select_admin_only"
  ON public.system_settings_audit
  FOR SELECT
  TO authenticated
  USING (is_god_or_super_admin(auth.uid()));

-- Audit trigger
CREATE OR REPLACE FUNCTION audit_system_settings_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.system_settings_audit (setting_key, new_value, action, changed_by)
    VALUES (NEW.key, NEW.value, 'INSERT', auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.system_settings_audit (setting_key, old_value, new_value, action, changed_by)
    VALUES (NEW.key, OLD.value, NEW.value, 'UPDATE', auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.system_settings_audit (setting_key, old_value, action, changed_by)
    VALUES (OLD.key, OLD.value, 'DELETE', auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS system_settings_audit_trigger ON public.system_settings;
CREATE TRIGGER system_settings_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION audit_system_settings_changes();

-- ============================================================
-- 3. TEAM INVITATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT,
  role TEXT NOT NULL DEFAULT 'member',
  message TEXT,
  status invitation_status_enum NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  responded_at TIMESTAMPTZ,
  invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  CONSTRAINT must_have_target CHECK (invited_user_id IS NOT NULL OR invited_email IS NOT NULL),
  CONSTRAINT valid_role CHECK (role IN ('member', 'co_leader'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON public.team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_invited_user ON public.team_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_invited_email ON public.team_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON public.team_invitations(status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON public.team_invitations(invite_token);

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "team_invitations_select" ON public.team_invitations;
DROP POLICY IF EXISTS "team_invitations_insert" ON public.team_invitations;
DROP POLICY IF EXISTS "team_invitations_update" ON public.team_invitations;
DROP POLICY IF EXISTS "team_invitations_delete" ON public.team_invitations;

-- SELECT: Can see invitations they sent or received
CREATE POLICY "team_invitations_select"
  ON public.team_invitations
  FOR SELECT
  TO authenticated
  USING (
    invited_by = auth.uid() 
    OR invited_user_id = auth.uid()
    OR is_team_leader_or_coleader(team_id, auth.uid())
    OR is_god_or_super_admin(auth.uid())
  );

-- INSERT: Only team leaders/co_leaders can invite
CREATE POLICY "team_invitations_insert"
  ON public.team_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND is_team_leader_or_coleader(team_id, auth.uid())
  );

-- UPDATE: Inviter can cancel, invitee can respond
CREATE POLICY "team_invitations_update"
  ON public.team_invitations
  FOR UPDATE
  TO authenticated
  USING (
    (invited_by = auth.uid() AND status = 'pending')
    OR (invited_user_id = auth.uid() AND status = 'pending')
    OR is_god_or_super_admin(auth.uid())
  )
  WITH CHECK (
    (invited_by = auth.uid() AND status = 'cancelled')
    OR (invited_user_id = auth.uid() AND status IN ('accepted', 'declined'))
    OR is_god_or_super_admin(auth.uid())
  );

-- DELETE: Only admins
CREATE POLICY "team_invitations_delete"
  ON public.team_invitations
  FOR DELETE
  TO authenticated
  USING (is_god_or_super_admin(auth.uid()));

-- Accept invitation function
CREATE OR REPLACE FUNCTION accept_team_invitation(invitation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_invitation RECORD;
  v_existing_member RECORD;
BEGIN
  SELECT * INTO v_invitation
  FROM public.team_invitations
  WHERE id = invitation_id
  AND (invited_user_id = auth.uid() OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  AND status = 'pending'
  AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  SELECT * INTO v_existing_member
  FROM public.team_members
  WHERE team_id = v_invitation.team_id
  AND user_id = auth.uid();
  
  IF FOUND THEN
    UPDATE public.team_invitations
    SET status = 'accepted', responded_at = NOW()
    WHERE id = invitation_id;
    
    RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this team');
  END IF;
  
  INSERT INTO public.team_members (team_id, user_id, role, joined_at)
  VALUES (v_invitation.team_id, auth.uid(), v_invitation.role, NOW());
  
  UPDATE public.team_invitations
  SET status = 'accepted', 
      responded_at = NOW(),
      invited_user_id = COALESCE(invited_user_id, auth.uid())
  WHERE id = invitation_id;
  
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_invitation.invited_by,
    'team',
    'Invitation Accepted',
    (SELECT name FROM public.users WHERE id = auth.uid()) || ' has joined your team!',
    jsonb_build_object('team_id', v_invitation.team_id, 'user_id', auth.uid())
  );
  
  RETURN jsonb_build_object('success', true, 'team_id', v_invitation.team_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decline invitation function
CREATE OR REPLACE FUNCTION decline_team_invitation(invitation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  SELECT * INTO v_invitation
  FROM public.team_invitations
  WHERE id = invitation_id
  AND (invited_user_id = auth.uid() OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found');
  END IF;
  
  UPDATE public.team_invitations
  SET status = 'declined', responded_at = NOW()
  WHERE id = invitation_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cancel invitation function
CREATE OR REPLACE FUNCTION cancel_team_invitation(invitation_id UUID)
RETURNS JSONB AS $$
BEGIN
  UPDATE public.team_invitations
  SET status = 'cancelled'
  WHERE id = invitation_id
  AND invited_by = auth.uid()
  AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel this invitation');
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notification trigger for new invitations
CREATE OR REPLACE FUNCTION notify_invitation_sent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invited_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, data, link)
    VALUES (
      NEW.invited_user_id,
      'team',
      'Team Invitation',
      (SELECT name FROM public.users WHERE id = NEW.invited_by) || 
        ' invited you to join ' || 
        (SELECT name FROM public.teams WHERE id = NEW.team_id),
      jsonb_build_object(
        'invitation_id', NEW.id,
        'team_id', NEW.team_id,
        'invited_by', NEW.invited_by
      ),
      '/teams/invitations'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_invitation_created ON public.team_invitations;
CREATE TRIGGER on_invitation_created
  AFTER INSERT ON public.team_invitations
  FOR EACH ROW EXECUTE FUNCTION notify_invitation_sent();

-- Grant permissions
GRANT EXECUTE ON FUNCTION accept_team_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_team_invitation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cancel_team_invitation(UUID) TO authenticated;

-- ============================================================
-- 4. MESSAGE REACTIONS (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id) -- One reaction per user per message
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON public.message_reactions(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON public.message_reactions(user_id);

ALTER TABLE public.message_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reactions_select" ON public.message_reactions;
DROP POLICY IF EXISTS "reactions_insert" ON public.message_reactions;
DROP POLICY IF EXISTS "reactions_delete" ON public.message_reactions;

CREATE POLICY "reactions_select"
  ON public.message_reactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "reactions_insert"
  ON public.message_reactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reactions_delete"
  ON public.message_reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- 5. MESSAGE REPORTS (if not exists)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.message_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewing', 'resolved')),
  reviewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  decrypted_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_reports_status ON public.message_reports(status);
CREATE INDEX IF NOT EXISTS idx_message_reports_message ON public.message_reports(message_id);

ALTER TABLE public.message_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reports_select_own" ON public.message_reports;
DROP POLICY IF EXISTS "reports_select_admin" ON public.message_reports;
DROP POLICY IF EXISTS "reports_insert" ON public.message_reports;
DROP POLICY IF EXISTS "reports_update_admin" ON public.message_reports;

CREATE POLICY "reports_select_own"
  ON public.message_reports FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

CREATE POLICY "reports_select_admin"
  ON public.message_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'moderator', 'god')
    )
  );

CREATE POLICY "reports_insert"
  ON public.message_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

CREATE POLICY "reports_update_admin"
  ON public.message_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'moderator', 'god')
    )
  );

-- ============================================================
-- 6. ADDITIONAL INDEXES FOR PERFORMANCE
-- ============================================================

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_chatroom_created ON public.messages(chatroom_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages(sender_id);

-- Chatroom members indexes
CREATE INDEX IF NOT EXISTS idx_chatroom_members_user_chatroom ON public.chatroom_members(user_id, chatroom_id);
CREATE INDEX IF NOT EXISTS idx_chatroom_members_chatroom ON public.chatroom_members(chatroom_id);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- Teams indexes
CREATE INDEX IF NOT EXISTS idx_teams_leader ON public.teams(leader_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON public.team_members(user_id);

-- Recruitment indexes
CREATE INDEX IF NOT EXISTS idx_recruitment_posts_status ON public.recruitment_posts(status);
CREATE INDEX IF NOT EXISTS idx_recruitment_posts_team ON public.recruitment_posts(team_id);
CREATE INDEX IF NOT EXISTS idx_applications_post ON public.applications(recruitment_post_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant ON public.applications(applicant_id);

-- ============================================================
-- 7. GRANTS
-- ============================================================

GRANT SELECT ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT SELECT, INSERT ON public.ticket_messages TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_invitations TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.message_reactions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.message_reports TO authenticated;

-- ============================================================
-- DONE! All tables and policies are now set up.
-- ============================================================
