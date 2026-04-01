-- START OF FILE -- schema_full_export.sql -- Generated for Supabase project jorhqtihmyjvktcrfzpf -- Contains extensions, types, tables, foreign keys, RLS enablement, suggested RLS policies, and Edge Function registrations. -- Validate in staging first.

-- Extensions
-- Installed extensions (created if not exists) CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS pg_trgm; CREATE EXTENSION IF NOT EXISTS rum; CREATE EXTENSION IF NOT EXISTS btree_gin; CREATE EXTENSION IF NOT EXISTS pg_stat_statements; CREATE EXTENSION IF NOT EXISTS uuid_ossp; CREATE EXTENSION IF NOT EXISTS unaccent; CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS pg_net; -- Note: Some extensions returned by the listing may be managed by the Supabase platform and may not be creatable manually (e.g., supabase_vault). If CREATE EXTENSION fails for those, remove or skip them.

-- ENUM types
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'preferred_gender_enum') THEN CREATE TYPE preferred_gender_enum AS ENUM ('male','female','any'); END IF; IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_status_enum') THEN CREATE TYPE event_status_enum AS ENUM ('draft','scheduled','live','ended','cancelled'); END IF; IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_registration_type_enum') THEN CREATE TYPE event_registration_type_enum AS ENUM ('registration_required','open'); END IF; IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_registration_flow_enum') THEN CREATE TYPE event_registration_flow_enum AS ENUM ('auto_approval','form_review'); END IF; IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'event_poll_mode



