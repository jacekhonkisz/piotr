-- Remove email drafts tables
-- This migration cleans up the old email draft system

-- Drop email drafts table if exists
DROP TABLE IF EXISTS email_drafts CASCADE;

-- Drop email templates table if exists  
DROP TABLE IF EXISTS email_templates CASCADE;

-- Clean up any orphaned policies (if they still exist)
-- Note: These will be removed automatically when tables are dropped 