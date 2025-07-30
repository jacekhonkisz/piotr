-- Create notes table for better note management
CREATE TABLE IF NOT EXISTS client_notes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE NOT NULL,
  admin_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  note_type TEXT DEFAULT 'internal' CHECK (note_type IN ('internal', 'client')),
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_admin_id ON client_notes(admin_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_created_at ON client_notes(created_at);
CREATE INDEX IF NOT EXISTS idx_client_notes_note_type ON client_notes(note_type);

-- Add RLS policies
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

-- Admins can view all notes
CREATE POLICY "Admins can view all client notes" ON client_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admins can insert notes
CREATE POLICY "Admins can insert client notes" ON client_notes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Admins can update their own notes
CREATE POLICY "Admins can update their own notes" ON client_notes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  ) WITH CHECK (
    admin_id = auth.uid()
  );

-- Admins can delete their own notes
CREATE POLICY "Admins can delete their own notes" ON client_notes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
    AND admin_id = auth.uid()
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_client_notes_updated_at 
  BEFORE UPDATE ON client_notes 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column(); 