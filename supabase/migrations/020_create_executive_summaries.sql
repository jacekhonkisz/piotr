-- Create executive_summaries table
CREATE TABLE IF NOT EXISTS executive_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    content TEXT NOT NULL,
    is_ai_generated BOOLEAN DEFAULT true,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique constraint to prevent duplicate summaries for same client and date range
CREATE UNIQUE INDEX IF NOT EXISTS idx_executive_summaries_client_date_range 
ON executive_summaries(client_id, date_range_start, date_range_end);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_executive_summaries_client_id 
ON executive_summaries(client_id);

CREATE INDEX IF NOT EXISTS idx_executive_summaries_date_range 
ON executive_summaries(date_range_start, date_range_end);

CREATE INDEX IF NOT EXISTS idx_executive_summaries_generated_at 
ON executive_summaries(generated_at);

-- Enable Row Level Security
ALTER TABLE executive_summaries ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy for clients to access their own summaries
CREATE POLICY "Clients can view their own executive summaries" ON executive_summaries
    FOR SELECT USING (
        client_id IN (
            SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'
        )
    );

-- Policy for clients to insert their own summaries
CREATE POLICY "Clients can insert their own executive summaries" ON executive_summaries
    FOR INSERT WITH CHECK (
        client_id IN (
            SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'
        )
    );

-- Policy for clients to update their own summaries
CREATE POLICY "Clients can update their own executive summaries" ON executive_summaries
    FOR UPDATE USING (
        client_id IN (
            SELECT id FROM clients WHERE email = auth.jwt() ->> 'email'
        )
    );

-- Policy for admins to access all summaries
CREATE POLICY "Admins can view all executive summaries" ON executive_summaries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy for admins to insert summaries
CREATE POLICY "Admins can insert executive summaries" ON executive_summaries
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Policy for admins to update summaries
CREATE POLICY "Admins can update executive summaries" ON executive_summaries
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_executive_summaries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_executive_summaries_updated_at
    BEFORE UPDATE ON executive_summaries
    FOR EACH ROW
    EXECUTE FUNCTION update_executive_summaries_updated_at(); 