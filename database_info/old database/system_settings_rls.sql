-- ============================================================
-- SYSTEM_SETTINGS TABLE RLS POLICIES
-- Only god/super_admin can modify, others read-only (if needed)
-- ============================================================

-- 1. First, create the system_settings table if not exists
CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Enable Row Level Security
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies (if any)
DROP POLICY IF EXISTS "system_settings_select" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_insert" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_update" ON public.system_settings;
DROP POLICY IF EXISTS "system_settings_delete" ON public.system_settings;

-- 4. Helper function to check if user is god/super_admin
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

-- 5. SELECT policy: All authenticated users can read (needed for app config)
-- Note: If you want to restrict some settings, add a "public" boolean column
CREATE POLICY "system_settings_select"
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- 6. INSERT policy: Only god/super_admin can insert
CREATE POLICY "system_settings_insert"
  ON public.system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (is_god_or_super_admin(auth.uid()));

-- 7. UPDATE policy: Only god/super_admin can update
CREATE POLICY "system_settings_update"
  ON public.system_settings
  FOR UPDATE
  TO authenticated
  USING (is_god_or_super_admin(auth.uid()))
  WITH CHECK (is_god_or_super_admin(auth.uid()));

-- 8. DELETE policy: Only god/super_admin can delete
CREATE POLICY "system_settings_delete"
  ON public.system_settings
  FOR DELETE
  TO authenticated
  USING (is_god_or_super_admin(auth.uid()));

-- 9. Create index for faster category lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON public.system_settings(category);

-- 10. Grant appropriate permissions
GRANT SELECT ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;

-- ============================================================
-- AUDIT TRIGGER for system_settings changes
-- ============================================================

-- Create audit log table for sensitive settings changes
CREATE TABLE IF NOT EXISTS public.system_settings_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  action TEXT NOT NULL, -- INSERT, UPDATE, DELETE
  changed_by UUID REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on audit table (only god/super_admin can view)
ALTER TABLE public.system_settings_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_admin_only"
  ON public.system_settings_audit
  FOR SELECT
  TO authenticated
  USING (is_god_or_super_admin(auth.uid()));

-- Audit trigger function
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

-- Create trigger
DROP TRIGGER IF EXISTS system_settings_audit_trigger ON public.system_settings;
CREATE TRIGGER system_settings_audit_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.system_settings
  FOR EACH ROW EXECUTE FUNCTION audit_system_settings_changes();
