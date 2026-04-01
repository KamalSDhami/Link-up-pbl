-- ============================================================
-- LINK-UP DATABASE FIXES - Issues 11-16
-- Run this file in Supabase SQL Editor
-- Generated: 2026-01-20
-- ============================================================

-- ============================================================
-- ISSUE 11: Chat Deletion Permission Error (RLS Bug)
-- ============================================================

-- The current issue: delete_chatroom RPC doesn't exist or has wrong permissions
-- Users need to be able to:
-- 1. Delete their own messages (hard delete)
-- 2. Leave/hide a 1-to-1 chat (soft delete via removing membership)
-- 3. Admins can delete any chat

-- Helper function: Check if user is a chatroom admin
CREATE OR REPLACE FUNCTION is_chatroom_admin(p_chatroom_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chatroom_roles
    WHERE chatroom_id = p_chatroom_id
    AND user_id = p_user_id
    AND can_manage_members = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function: Check if user is a chatroom member
-- SECURITY DEFINER bypasses RLS to avoid infinite recursion
CREATE OR REPLACE FUNCTION is_chatroom_member(p_chatroom_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.chatroom_members
    WHERE chatroom_id = p_chatroom_id
    AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==============================
-- MESSAGES TABLE RLS POLICIES
-- ==============================

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Drop existing message policies
DROP POLICY IF EXISTS "Members can view messages" ON public.messages;
DROP POLICY IF EXISTS "Members can send messages" ON public.messages;
DROP POLICY IF EXISTS "message_select_policy" ON public.messages;
DROP POLICY IF EXISTS "message_insert_policy" ON public.messages;
DROP POLICY IF EXISTS "message_update_policy" ON public.messages;
DROP POLICY IF EXISTS "message_delete_policy" ON public.messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;

-- SELECT: Members can view messages in their chatrooms
CREATE POLICY "message_select_policy"
  ON public.messages FOR SELECT
  TO authenticated
  USING (is_chatroom_member(chatroom_id, auth.uid()));

-- INSERT: Members can send messages
CREATE POLICY "message_insert_policy"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() 
    AND is_chatroom_member(chatroom_id, auth.uid())
  );

-- UPDATE: Only sender can edit their own messages
CREATE POLICY "message_update_policy"
  ON public.messages FOR UPDATE
  TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- DELETE: Sender can delete own messages OR chatroom admin can delete any message
CREATE POLICY "message_delete_policy"
  ON public.messages FOR DELETE
  TO authenticated
  USING (
    sender_id = auth.uid() 
    OR is_chatroom_admin(chatroom_id, auth.uid())
    OR is_god_or_super_admin(auth.uid())
  );

-- ==============================
-- CHATROOM_MEMBERS TABLE RLS
-- ==============================

ALTER TABLE public.chatroom_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own memberships" ON public.chatroom_members;
DROP POLICY IF EXISTS "Chat managers invite members" ON public.chatroom_members;
DROP POLICY IF EXISTS "Chat managers update members" ON public.chatroom_members;
DROP POLICY IF EXISTS "Chat managers remove members" ON public.chatroom_members;
DROP POLICY IF EXISTS "Chat members add self" ON public.chatroom_members;
DROP POLICY IF EXISTS "chatroom_members_select" ON public.chatroom_members;
DROP POLICY IF EXISTS "chatroom_members_insert" ON public.chatroom_members;
DROP POLICY IF EXISTS "chatroom_members_update" ON public.chatroom_members;
DROP POLICY IF EXISTS "chatroom_members_delete" ON public.chatroom_members;

-- SELECT: Users can view their own memberships OR other members of their chatrooms
-- Uses SECURITY DEFINER function to avoid infinite recursion
CREATE POLICY "chatroom_members_select"
  ON public.chatroom_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_chatroom_member(chatroom_id, auth.uid())
  );

-- INSERT: Admins can add members OR users can add themselves (for DMs)
CREATE POLICY "chatroom_members_insert"
  ON public.chatroom_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR is_chatroom_admin(chatroom_id, auth.uid())
  );

-- UPDATE: Chatroom admins can update member records
CREATE POLICY "chatroom_members_update"
  ON public.chatroom_members FOR UPDATE
  TO authenticated
  USING (is_chatroom_admin(chatroom_id, auth.uid()))
  WITH CHECK (is_chatroom_admin(chatroom_id, auth.uid()));

-- DELETE: Users can leave (remove self) OR admins can remove others
CREATE POLICY "chatroom_members_delete"
  ON public.chatroom_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()  -- Can leave any chat
    OR is_chatroom_admin(chatroom_id, auth.uid())  -- Admin can remove anyone
    OR is_god_or_super_admin(auth.uid())  -- Super admin override
  );

-- ==============================
-- CHATROOMS TABLE RLS
-- ==============================

ALTER TABLE public.chatrooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view chatrooms" ON public.chatrooms;
DROP POLICY IF EXISTS "chatrooms_select" ON public.chatrooms;
DROP POLICY IF EXISTS "chatrooms_insert" ON public.chatrooms;
DROP POLICY IF EXISTS "chatrooms_update" ON public.chatrooms;
DROP POLICY IF EXISTS "chatrooms_delete" ON public.chatrooms;

-- SELECT: Members can view their chatrooms
-- Uses SECURITY DEFINER function to avoid RLS recursion
CREATE POLICY "chatrooms_select"
  ON public.chatrooms FOR SELECT
  TO authenticated
  USING (
    is_chatroom_member(id, auth.uid())
  );

-- INSERT: Authenticated users can create chatrooms
CREATE POLICY "chatrooms_insert"
  ON public.chatrooms FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Chatroom admins can update
CREATE POLICY "chatrooms_update"
  ON public.chatrooms FOR UPDATE
  TO authenticated
  USING (is_chatroom_admin(id, auth.uid()) OR is_god_or_super_admin(auth.uid()));

-- DELETE: Chatroom admins can delete (for group chats) OR god/super_admin
CREATE POLICY "chatrooms_delete"
  ON public.chatrooms FOR DELETE
  TO authenticated
  USING (
    is_chatroom_admin(id, auth.uid())
    OR is_god_or_super_admin(auth.uid())
  );

-- ==============================
-- DELETE CHATROOM RPC FUNCTION
-- ==============================

-- IMPORTANT: DROP first to avoid "cannot change return type" errors
DROP FUNCTION IF EXISTS delete_chatroom(UUID);
DROP FUNCTION IF EXISTS leave_chatroom(UUID);

-- This function safely deletes a chatroom and all related data
CREATE FUNCTION delete_chatroom(p_chatroom_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_chatroom RECORD;
  v_is_admin BOOLEAN;
  v_is_member BOOLEAN;
  v_chat_type TEXT;
BEGIN
  -- Get chatroom info
  SELECT * INTO v_chatroom FROM public.chatrooms WHERE id = p_chatroom_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Chatroom not found');
  END IF;
  
  v_chat_type := v_chatroom.type;
  v_is_admin := is_chatroom_admin(p_chatroom_id, auth.uid());
  v_is_member := is_chatroom_member(p_chatroom_id, auth.uid());
  
  -- Check permissions
  IF NOT v_is_member AND NOT is_god_or_super_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not a member of this chat');
  END IF;
  
  -- For DMs: Any participant can delete (it removes for everyone)
  -- For Groups: Only admin can delete
  IF v_chat_type = 'group' AND NOT v_is_admin AND NOT is_god_or_super_admin(auth.uid()) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only group admins can delete this chat');
  END IF;
  
  -- Delete related data in order (due to foreign keys)
  DELETE FROM public.message_reactions WHERE message_id IN (
    SELECT id FROM public.messages WHERE chatroom_id = p_chatroom_id
  );
  DELETE FROM public.message_reports WHERE message_id IN (
    SELECT id FROM public.messages WHERE chatroom_id = p_chatroom_id
  );
  DELETE FROM public.messages WHERE chatroom_id = p_chatroom_id;
  DELETE FROM public.chatroom_mutes WHERE chatroom_id = p_chatroom_id;
  DELETE FROM public.chatroom_roles WHERE chatroom_id = p_chatroom_id;
  DELETE FROM public.chatroom_members WHERE chatroom_id = p_chatroom_id;
  DELETE FROM public.chatrooms WHERE id = p_chatroom_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Alternative: Leave chatroom (soft delete - just removes user's membership)
CREATE FUNCTION leave_chatroom(p_chatroom_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_is_member BOOLEAN;
  v_member_count INTEGER;
  v_chat_type TEXT;
BEGIN
  v_is_member := is_chatroom_member(p_chatroom_id, auth.uid());
  
  IF NOT v_is_member THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are not a member of this chat');
  END IF;
  
  -- Get chat type and member count
  SELECT type INTO v_chat_type FROM public.chatrooms WHERE id = p_chatroom_id;
  SELECT COUNT(*) INTO v_member_count FROM public.chatroom_members WHERE chatroom_id = p_chatroom_id;
  
  -- Remove user's membership
  DELETE FROM public.chatroom_members WHERE chatroom_id = p_chatroom_id AND user_id = auth.uid();
  DELETE FROM public.chatroom_roles WHERE chatroom_id = p_chatroom_id AND user_id = auth.uid();
  DELETE FROM public.chatroom_mutes WHERE chatroom_id = p_chatroom_id AND user_id = auth.uid();
  
  -- If this was the last member, delete the entire chatroom
  IF v_member_count <= 1 THEN
    DELETE FROM public.message_reactions WHERE message_id IN (
      SELECT id FROM public.messages WHERE chatroom_id = p_chatroom_id
    );
    DELETE FROM public.messages WHERE chatroom_id = p_chatroom_id;
    DELETE FROM public.chatrooms WHERE id = p_chatroom_id;
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION delete_chatroom(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION leave_chatroom(UUID) TO authenticated;

-- ============================================================
-- ISSUE 12: Add Friend / Add Connection Feature
-- (friends, friend_requests tables should already exist)
-- ============================================================

-- Make sure friend_requests table exists with proper structure
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(sender_id, receiver_id)
);

-- Contacts table (mutual friends / connections)
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  nickname TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, contact_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON public.friend_requests(sender_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver ON public.friend_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_status ON public.friend_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_contacts_owner ON public.contacts(owner_id);
CREATE INDEX IF NOT EXISTS idx_contacts_contact ON public.contacts(contact_id);

-- Enable RLS
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Friend Requests Policies
DROP POLICY IF EXISTS "Friend requests select" ON public.friend_requests;
DROP POLICY IF EXISTS "Friend requests insert" ON public.friend_requests;
DROP POLICY IF EXISTS "Friend requests update" ON public.friend_requests;
DROP POLICY IF EXISTS "Friend requests delete" ON public.friend_requests;
DROP POLICY IF EXISTS "friend_requests_select" ON public.friend_requests;
DROP POLICY IF EXISTS "friend_requests_insert" ON public.friend_requests;
DROP POLICY IF EXISTS "friend_requests_update" ON public.friend_requests;
DROP POLICY IF EXISTS "friend_requests_delete" ON public.friend_requests;

CREATE POLICY "friend_requests_select"
  ON public.friend_requests FOR SELECT
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "friend_requests_insert"
  ON public.friend_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND sender_id != receiver_id  -- Can't send request to self
    AND NOT EXISTS (  -- Prevent duplicate pending requests
      SELECT 1 FROM public.friend_requests
      WHERE ((sender_id = auth.uid() AND receiver_id = friend_requests.receiver_id)
         OR (receiver_id = auth.uid() AND sender_id = friend_requests.receiver_id))
      AND status = 'pending'
    )
  );

CREATE POLICY "friend_requests_update"
  ON public.friend_requests FOR UPDATE
  TO authenticated
  USING (receiver_id = auth.uid() AND status = 'pending')  -- Only receiver can respond
  WITH CHECK (receiver_id = auth.uid());

CREATE POLICY "friend_requests_delete"
  ON public.friend_requests FOR DELETE
  TO authenticated
  USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Contacts Policies
DROP POLICY IF EXISTS "Contacts select" ON public.contacts;
DROP POLICY IF EXISTS "Contacts manage" ON public.contacts;
DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
DROP POLICY IF EXISTS "contacts_insert" ON public.contacts;
DROP POLICY IF EXISTS "contacts_delete" ON public.contacts;

CREATE POLICY "contacts_select"
  ON public.contacts FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR contact_id = auth.uid());

CREATE POLICY "contacts_insert"
  ON public.contacts FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "contacts_delete"
  ON public.contacts FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- Function to remove a contact (unfriend)
-- IMPORTANT: DROP first because PostgreSQL cannot change return type with CREATE OR REPLACE
-- Use DROP + CREATE when:
--   1. Changing return type
--   2. Changing parameter types
--   3. Changing volatility (STABLE/VOLATILE/IMMUTABLE)
-- Use CREATE OR REPLACE when:
--   1. Only changing function body
--   2. Adding default values to existing parameters
DROP FUNCTION IF EXISTS remove_contact_pair(UUID);

CREATE FUNCTION remove_contact_pair(friend_id UUID)
RETURNS JSONB AS $$
BEGIN
  -- Remove both directions
  DELETE FROM public.contacts
  WHERE (owner_id = auth.uid() AND contact_id = friend_id)
     OR (owner_id = friend_id AND contact_id = auth.uid());
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also ensure other functions are properly dropped first if they exist with different signatures
DROP FUNCTION IF EXISTS accept_friend_request(UUID);
DROP FUNCTION IF EXISTS reject_friend_request(UUID);

CREATE FUNCTION accept_friend_request(p_request_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_request RECORD;
BEGIN
  -- Get request
  SELECT * INTO v_request
  FROM public.friend_requests
  WHERE id = p_request_id
  AND receiver_id = auth.uid()
  AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found or already processed');
  END IF;
  
  -- Update request status
  UPDATE public.friend_requests
  SET status = 'accepted', responded_at = NOW()
  WHERE id = p_request_id;
  
  -- Create mutual contacts (both directions)
  INSERT INTO public.contacts (owner_id, contact_id)
  VALUES 
    (v_request.sender_id, v_request.receiver_id),
    (v_request.receiver_id, v_request.sender_id)
  ON CONFLICT (owner_id, contact_id) DO NOTHING;
  
  -- Notify sender
  INSERT INTO public.notifications (user_id, type, title, message, data)
  VALUES (
    v_request.sender_id,
    'system',
    'Friend Request Accepted',
    (SELECT name FROM public.users WHERE id = auth.uid()) || ' accepted your friend request!',
    jsonb_build_object('user_id', auth.uid())
  );
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE FUNCTION reject_friend_request(p_request_id UUID)
RETURNS JSONB AS $$
BEGIN
  UPDATE public.friend_requests
  SET status = 'rejected', responded_at = NOW()
  WHERE id = p_request_id
  AND receiver_id = auth.uid()
  AND status = 'pending';
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request not found');
  END IF;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION accept_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_friend_request(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_contact_pair(UUID) TO authenticated;

-- ============================================================
-- ISSUE 14: Reaction Display - Store reactor name
-- ============================================================

-- Add reactor info to message_reactions if not exists
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'message_reactions' AND column_name = 'reactor_name'
  ) THEN
    ALTER TABLE public.message_reactions ADD COLUMN reactor_name TEXT;
  END IF;
END $$;

-- Trigger to auto-populate reactor_name on insert
CREATE OR REPLACE FUNCTION set_reactor_name()
RETURNS TRIGGER AS $$
BEGIN
  SELECT name INTO NEW.reactor_name
  FROM public.users
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_reactor_name ON public.message_reactions;
CREATE TRIGGER trigger_set_reactor_name
  BEFORE INSERT ON public.message_reactions
  FOR EACH ROW
  EXECUTE FUNCTION set_reactor_name();

-- ============================================================
-- CHATROOM ROLES - Ensure table exists with proper structure
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chatroom_roles (
  chatroom_id UUID NOT NULL REFERENCES public.chatrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'moderator', 'member')),
  can_post BOOLEAN DEFAULT true,
  can_manage_members BOOLEAN DEFAULT false,
  can_manage_messages BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (chatroom_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chatroom_roles_chatroom ON public.chatroom_roles(chatroom_id);
CREATE INDEX IF NOT EXISTS idx_chatroom_roles_user ON public.chatroom_roles(user_id);

ALTER TABLE public.chatroom_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chatroom_roles_select" ON public.chatroom_roles;
DROP POLICY IF EXISTS "chatroom_roles_insert" ON public.chatroom_roles;
DROP POLICY IF EXISTS "chatroom_roles_update" ON public.chatroom_roles;
DROP POLICY IF EXISTS "chatroom_roles_delete" ON public.chatroom_roles;

CREATE POLICY "chatroom_roles_select"
  ON public.chatroom_roles FOR SELECT
  TO authenticated
  USING (is_chatroom_member(chatroom_id, auth.uid()));

CREATE POLICY "chatroom_roles_insert"
  ON public.chatroom_roles FOR INSERT
  TO authenticated
  WITH CHECK (is_chatroom_admin(chatroom_id, auth.uid()) OR user_id = auth.uid());

CREATE POLICY "chatroom_roles_update"
  ON public.chatroom_roles FOR UPDATE
  TO authenticated
  USING (is_chatroom_admin(chatroom_id, auth.uid()));

CREATE POLICY "chatroom_roles_delete"
  ON public.chatroom_roles FOR DELETE
  TO authenticated
  USING (is_chatroom_admin(chatroom_id, auth.uid()) OR user_id = auth.uid());

-- ============================================================
-- CHATROOM MUTES - Ensure table exists
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chatroom_mutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chatroom_id UUID NOT NULL REFERENCES public.chatrooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  muted_until TIMESTAMPTZ,
  muted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chatroom_id, user_id)
);

ALTER TABLE public.chatroom_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chatroom_mutes_select" ON public.chatroom_mutes;
DROP POLICY IF EXISTS "chatroom_mutes_manage" ON public.chatroom_mutes;

CREATE POLICY "chatroom_mutes_select"
  ON public.chatroom_mutes FOR SELECT
  TO authenticated
  USING (is_chatroom_member(chatroom_id, auth.uid()));

CREATE POLICY "chatroom_mutes_manage"
  ON public.chatroom_mutes FOR ALL
  TO authenticated
  USING (is_chatroom_admin(chatroom_id, auth.uid()));

-- ============================================================
-- DONE
-- ============================================================

-- ============================================================
-- MESSENGER-STYLE MESSAGE STATUS (Delivered/Seen/Read Receipts)
-- ============================================================

-- Add status columns to messages table for delivery/read tracking
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN status TEXT DEFAULT 'sent' 
      CHECK (status IN ('sending', 'sent', 'delivered', 'seen'));
  END IF;
END $$;

-- Track when message was delivered to recipient(s)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN delivered_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create a table to track read receipts per user per message
-- This allows tracking "seen by" for group chats
CREATE TABLE IF NOT EXISTS public.message_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_message_read_receipts_message ON public.message_read_receipts(message_id);
CREATE INDEX IF NOT EXISTS idx_message_read_receipts_user ON public.message_read_receipts(user_id);

ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_receipts_select" ON public.message_read_receipts;
DROP POLICY IF EXISTS "read_receipts_insert" ON public.message_read_receipts;

-- Users can view read receipts for messages in their chatrooms
CREATE POLICY "read_receipts_select"
  ON public.message_read_receipts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id
      AND is_chatroom_member(m.chatroom_id, auth.uid())
    )
  );

-- Users can mark messages as read
CREATE POLICY "read_receipts_insert"
  ON public.message_read_receipts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Function to mark messages as delivered when user connects
CREATE OR REPLACE FUNCTION mark_messages_delivered(p_chatroom_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.messages
  SET 
    status = 'delivered',
    delivered_at = COALESCE(delivered_at, NOW())
  WHERE chatroom_id = p_chatroom_id
    AND sender_id != auth.uid()
    AND status = 'sent';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark messages as seen and create read receipts
CREATE OR REPLACE FUNCTION mark_messages_seen(p_chatroom_id UUID, p_up_to_message_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_message_ids UUID[];
BEGIN
  -- Get messages to mark as seen
  IF p_up_to_message_id IS NOT NULL THEN
    SELECT ARRAY_AGG(id) INTO v_message_ids
    FROM public.messages
    WHERE chatroom_id = p_chatroom_id
      AND sender_id != auth.uid()
      AND created_at <= (SELECT created_at FROM public.messages WHERE id = p_up_to_message_id)
      AND status IN ('sent', 'delivered');
  ELSE
    SELECT ARRAY_AGG(id) INTO v_message_ids
    FROM public.messages
    WHERE chatroom_id = p_chatroom_id
      AND sender_id != auth.uid()
      AND status IN ('sent', 'delivered');
  END IF;

  -- Create read receipts
  IF v_message_ids IS NOT NULL AND array_length(v_message_ids, 1) > 0 THEN
    INSERT INTO public.message_read_receipts (message_id, user_id)
    SELECT unnest(v_message_ids), auth.uid()
    ON CONFLICT (message_id, user_id) DO NOTHING;
    
    -- Update message status to 'seen' for DMs (2 participants)
    -- For groups, status becomes 'seen' when all members have read it
    UPDATE public.messages m
    SET status = 'seen'
    WHERE m.id = ANY(v_message_ids)
      AND (
        -- For DMs: mark as seen immediately
        (SELECT type FROM public.chatrooms WHERE id = p_chatroom_id) = 'dm'
        OR
        -- For groups: check if all other members have read
        NOT EXISTS (
          SELECT 1 FROM public.chatroom_members cm
          WHERE cm.chatroom_id = p_chatroom_id
            AND cm.user_id != m.sender_id
            AND NOT EXISTS (
              SELECT 1 FROM public.message_read_receipts rr
              WHERE rr.message_id = m.id AND rr.user_id = cm.user_id
            )
        )
      );
  END IF;
  
  -- Also update last_read_at in chatroom_members
  UPDATE public.chatroom_members
  SET last_read_at = NOW()
  WHERE chatroom_id = p_chatroom_id
    AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get message read receipts for display
CREATE OR REPLACE FUNCTION get_message_read_receipts(p_message_id UUID)
RETURNS TABLE (
  user_id UUID,
  user_name TEXT,
  user_avatar TEXT,
  read_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    rr.user_id,
    u.name AS user_name,
    u.profile_picture_url AS user_avatar,
    rr.read_at
  FROM public.message_read_receipts rr
  JOIN public.users u ON u.id = rr.user_id
  WHERE rr.message_id = p_message_id
  ORDER BY rr.read_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION mark_messages_delivered(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_seen(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_message_read_receipts(UUID) TO authenticated;
GRANT SELECT, INSERT ON public.message_read_receipts TO authenticated;

-- ============================================================
-- ISSUE 21: Admin Ticket Management - RLS Policies
-- ============================================================

-- Ensure admins can view ALL tickets
DROP POLICY IF EXISTS "Users can view own tickets" ON support_tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can view all tickets" ON support_tickets;
DROP POLICY IF EXISTS "Admins can update tickets" ON support_tickets;
DROP POLICY IF EXISTS "support_tickets_select" ON support_tickets;
DROP POLICY IF EXISTS "support_tickets_insert" ON support_tickets;
DROP POLICY IF EXISTS "support_tickets_update" ON support_tickets;

-- SELECT: Users can view their own tickets, admins can view all
CREATE POLICY "support_tickets_select"
  ON support_tickets FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_god_or_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('moderator', 'super_admin', 'god')
    )
  );

-- INSERT: Any authenticated user can create tickets
CREATE POLICY "support_tickets_insert"
  ON support_tickets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- UPDATE: Ticket owner or admins can update
CREATE POLICY "support_tickets_update"
  ON support_tickets FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR is_god_or_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('moderator', 'super_admin', 'god')
    )
  );

-- Ticket messages policies
DROP POLICY IF EXISTS "Users can view ticket messages" ON ticket_messages;
DROP POLICY IF EXISTS "Users can send ticket messages" ON ticket_messages;
DROP POLICY IF EXISTS "ticket_messages_select" ON ticket_messages;
DROP POLICY IF EXISTS "ticket_messages_insert" ON ticket_messages;

-- SELECT: View messages for tickets you have access to
CREATE POLICY "ticket_messages_select"
  ON ticket_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE id = ticket_messages.ticket_id
      AND (
        user_id = auth.uid()
        OR is_god_or_super_admin(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
          AND role IN ('moderator', 'super_admin', 'god')
        )
      )
    )
  );

-- INSERT: Send messages to tickets you have access to
CREATE POLICY "ticket_messages_insert"
  ON ticket_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM support_tickets
      WHERE id = ticket_messages.ticket_id
      AND (
        user_id = auth.uid()
        OR is_god_or_super_admin(auth.uid())
        OR EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
          AND role IN ('moderator', 'super_admin', 'god')
        )
      )
    )
  );

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friend_requests TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatroom_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chatroom_mutes TO authenticated;
