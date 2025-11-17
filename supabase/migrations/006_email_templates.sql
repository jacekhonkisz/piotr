-- Email Templates Table
-- Stores client-specific and main (global) email templates
-- Date: November 17, 2025

-- Drop table if exists (clean slate)
DROP TABLE IF EXISTS email_templates CASCADE;

-- Create email_templates table
CREATE TABLE email_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Client relationship (NULL = main/global template)
  client_id UUID,
  admin_id UUID,
  
  -- Template metadata
  template_type VARCHAR(50) NOT NULL DEFAULT 'monthly_report',
  template_name VARCHAR(255),
  
  -- Template content
  html_template TEXT NOT NULL,
  text_template TEXT,
  subject_template VARCHAR(500),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraints (conditionally)
DO $$ 
BEGIN
  -- Add foreign key to clients if table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    ALTER TABLE email_templates 
      ADD CONSTRAINT email_templates_client_id_fkey 
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
    RAISE NOTICE 'Added foreign key to clients table';
  ELSE
    RAISE NOTICE 'clients table not found, skipping foreign key';
  END IF;
END $$;

-- Add foreign key to auth.users
ALTER TABLE email_templates 
  ADD CONSTRAINT email_templates_admin_id_fkey 
  FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX idx_email_templates_client_id ON email_templates(client_id);
CREATE INDEX idx_email_templates_type ON email_templates(template_type);
CREATE INDEX idx_email_templates_active ON email_templates(is_active);
CREATE INDEX idx_email_templates_main ON email_templates(client_id) WHERE client_id IS NULL;

-- RLS Policies
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

-- Admin can read all templates
CREATE POLICY "Admin can view templates"
  ON email_templates
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin can insert templates
CREATE POLICY "Admin can create templates"
  ON email_templates
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin can update templates
CREATE POLICY "Admin can update templates"
  ON email_templates
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admin can delete templates
CREATE POLICY "Admin can delete templates"
  ON email_templates
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_email_template_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_email_template_timestamp_trigger
  BEFORE UPDATE ON email_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_email_template_timestamp();

-- Comments for documentation
COMMENT ON TABLE email_templates IS 'Stores email templates (client-specific and main/global)';
COMMENT ON COLUMN email_templates.client_id IS 'NULL = main/global template, NOT NULL = client-specific template';
COMMENT ON COLUMN email_templates.template_type IS 'Type of template (e.g., monthly_report, weekly_report)';
COMMENT ON COLUMN email_templates.is_active IS 'Only active templates are used for sending emails';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ email_templates table created successfully!';
END $$;
