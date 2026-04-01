-- Support Tickets System Schema
-- Run this in Supabase SQL Editor

-- Create ticket status enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_status_enum') THEN
    CREATE TYPE ticket_status_enum AS ENUM ('open', 'in_progress', 'resolved', 'closed');
  END IF;
END $$;

-- Create ticket priority enum
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ticket_priority_enum') THEN
    CREATE TYPE ticket_priority_enum AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;
END $$;

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned ON support_tickets(assigned_admin_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_sender_id ON ticket_messages(sender_id);

-- Update timestamp trigger
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

-- Row Level Security Policies

-- Enable RLS
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_messages ENABLE ROW LEVEL SECURITY;

-- Support Tickets Policies
-- Users can view their own tickets
CREATE POLICY "Users can view own tickets"
  ON support_tickets FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all tickets
CREATE POLICY "Admins can view all tickets"
  ON support_tickets FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'moderator', 'god')
    )
  );

-- Users can create tickets
CREATE POLICY "Users can create tickets"
  ON support_tickets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own tickets (limited fields)
CREATE POLICY "Users can update own tickets"
  ON support_tickets FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admins can update any ticket
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
-- Users can view messages on their tickets
CREATE POLICY "Users can view messages on own tickets"
  ON ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM support_tickets
      WHERE id = ticket_messages.ticket_id
      AND user_id = auth.uid()
    )
  );

-- Admins can view all ticket messages
CREATE POLICY "Admins can view all ticket messages"
  ON ticket_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'moderator', 'god')
    )
  );

-- Users can send messages on their tickets
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

-- Admins can send messages on any ticket
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

-- RPC function to get ticket with message count
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
  -- Check if caller is admin
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_user_tickets(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_tickets() TO authenticated;
