-- Add settings JSONB column to users table for feature flags and user preferences
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "settings" JSONB NOT NULL DEFAULT '{}';

-- Create index for JSONB queries on settings.debug.rbacInspectorEnabled
CREATE INDEX IF NOT EXISTS "users_settings_rbac_inspector_idx" ON "users" USING GIN (("settings" -> 'debug' -> 'rbacInspectorEnabled'));

