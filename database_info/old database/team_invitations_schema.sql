-- ============================================================
-- TEAM INVITATIONS SYSTEM
-- Manual invites by team leaders/admins
-- ============================================================

-- 1. Create ENUM for invitation status
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invitation_status_enum') THEN
    CREATE TYPE invitation_status_enum AS ENUM ('pending', 'accepted', 'declined', 'expired', 'cancelled');
  END IF;
END $$;

-- 2. Create team_invitations table
CREATE TABLE IF NOT EXISTS public.team_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Team info
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Who invited
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Who is being invited (can be by user_id or email)
  invited_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_email TEXT, -- For inviting users who may not have an account yet
  
  -- Invitation details
  role TEXT NOT NULL DEFAULT 'member', -- The role they'll have when joining
  message TEXT, -- Optional message from inviter
  
  -- Status tracking
  status invitation_status_enum NOT NULL DEFAULT 'pending',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
  responded_at TIMESTAMPTZ,
  
  -- Token for email invites (secure random string)
  invite_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  
  -- Constraints
  CONSTRAINT must_have_target CHECK (invited_user_id IS NOT NULL OR invited_email IS NOT NULL),
  CONSTRAINT valid_role CHECK (role IN ('member', 'co_leader'))
);

-- 3. Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_team_invitations_team_id ON public.team_invitations(team_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_invited_user ON public.team_invitations(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_team_invitations_invited_email ON public.team_invitations(invited_email);
CREATE INDEX IF NOT EXISTS idx_team_invitations_status ON public.team_invitations(status);
CREATE INDEX IF NOT EXISTS idx_team_invitations_token ON public.team_invitations(invite_token);
CREATE INDEX IF NOT EXISTS idx_team_invitations_expires ON public.team_invitations(expires_at) WHERE status = 'pending';

-- 5. RLS Policies

-- Helper function: Check if user is team leader or co_leader
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

-- SELECT: Users can see invitations they sent OR invitations sent to them
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

-- INSERT: Only team leaders/co_leaders can send invitations
CREATE POLICY "team_invitations_insert"
  ON public.team_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND is_team_leader_or_coleader(team_id, auth.uid())
  );

-- UPDATE: Inviter can cancel, invitee can accept/decline
CREATE POLICY "team_invitations_update"
  ON public.team_invitations
  FOR UPDATE
  TO authenticated
  USING (
    (invited_by = auth.uid() AND status = 'pending') -- Inviter can cancel pending
    OR (invited_user_id = auth.uid() AND status = 'pending') -- Invitee can respond
    OR is_god_or_super_admin(auth.uid())
  )
  WITH CHECK (
    (invited_by = auth.uid() AND status = 'cancelled') -- Can only cancel
    OR (invited_user_id = auth.uid() AND status IN ('accepted', 'declined')) -- Can accept/decline
    OR is_god_or_super_admin(auth.uid())
  );

-- DELETE: Only admins can delete
CREATE POLICY "team_invitations_delete"
  ON public.team_invitations
  FOR DELETE
  TO authenticated
  USING (is_god_or_super_admin(auth.uid()));

-- 6. Function to accept invitation and add user to team
CREATE OR REPLACE FUNCTION accept_team_invitation(invitation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_invitation RECORD;
  v_existing_member RECORD;
BEGIN
  -- Get invitation
  SELECT * INTO v_invitation
  FROM public.team_invitations
  WHERE id = invitation_id
  AND (invited_user_id = auth.uid() OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  AND status = 'pending'
  AND expires_at > NOW();
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invitation');
  END IF;
  
  -- Check if already a member
  SELECT * INTO v_existing_member
  FROM public.team_members
  WHERE team_id = v_invitation.team_id
  AND user_id = auth.uid();
  
  IF FOUND THEN
    -- Update invitation status anyway
    UPDATE public.team_invitations
    SET status = 'accepted', responded_at = NOW()
    WHERE id = invitation_id;
    
    RETURN jsonb_build_object('success', false, 'error', 'You are already a member of this team');
  END IF;
  
  -- Add user to team
  INSERT INTO public.team_members (team_id, user_id, role, joined_at)
  VALUES (v_invitation.team_id, auth.uid(), v_invitation.role, NOW());
  
  -- Update invitation status
  UPDATE public.team_invitations
  SET status = 'accepted', 
      responded_at = NOW(),
      invited_user_id = COALESCE(invited_user_id, auth.uid())
  WHERE id = invitation_id;
  
  -- Create notification for inviter
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_invitation.invited_by,
    'team',
    'Invitation Accepted',
    (SELECT full_name FROM public.users WHERE id = auth.uid()) || ' has joined your team!',
    jsonb_build_object('team_id', v_invitation.team_id, 'user_id', auth.uid())
  );
  
  RETURN jsonb_build_object('success', true, 'team_id', v_invitation.team_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function to decline invitation
CREATE OR REPLACE FUNCTION decline_team_invitation(invitation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_invitation RECORD;
BEGIN
  -- Get invitation
  SELECT * INTO v_invitation
  FROM public.team_invitations
  WHERE id = invitation_id
  AND (invited_user_id = auth.uid() OR invited_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
  AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found or already responded');
  END IF;
  
  -- Update invitation status
  UPDATE public.team_invitations
  SET status = 'declined', responded_at = NOW()
  WHERE id = invitation_id;
  
  -- Optional: Notify inviter
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_invitation.invited_by,
    'team',
    'Invitation Declined',
    (SELECT full_name FROM public.users WHERE id = auth.uid()) || ' has declined your team invitation.',
    jsonb_build_object('team_id', v_invitation.team_id)
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function to cancel invitation (by inviter)
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

-- 9. Cron job to expire old invitations (run daily)
-- Note: Requires pg_cron extension or Supabase Edge Function
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE public.team_invitations
  SET status = 'expired'
  WHERE status = 'pending'
  AND expires_at < NOW();
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. View for pending invitations with team/user details
CREATE OR REPLACE VIEW public.pending_invitations_view AS
SELECT 
  ti.id,
  ti.team_id,
  t.name AS team_name,
  t.logo_url AS team_logo,
  ti.invited_by,
  inviter.full_name AS inviter_name,
  inviter.avatar_url AS inviter_avatar,
  ti.invited_user_id,
  ti.invited_email,
  ti.role,
  ti.message,
  ti.created_at,
  ti.expires_at
FROM public.team_invitations ti
JOIN public.teams t ON t.id = ti.team_id
JOIN public.users inviter ON inviter.id = ti.invited_by
WHERE ti.status = 'pending'
AND ti.expires_at > NOW();

-- Grant access to the view
GRANT SELECT ON public.pending_invitations_view TO authenticated;

-- 11. Trigger to create notification when invitation is sent
CREATE OR REPLACE FUNCTION notify_invitation_sent()
RETURNS TRIGGER AS $$
BEGIN
  -- Only notify if invited_user_id is set (existing user)
  IF NEW.invited_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, data, link)
    VALUES (
      NEW.invited_user_id,
      'team',
      'Team Invitation',
      (SELECT full_name FROM public.users WHERE id = NEW.invited_by) || 
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
