-- Create monthly_summaries table for historical monthly data
-- This separates monthly data from weekly data in campaign_summaries

CREATE TABLE IF NOT EXISTS public.monthly_summaries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    summary_date DATE NOT NULL, -- First day of the month (e.g., 2025-08-01)
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    platform VARCHAR(20) NOT NULL DEFAULT 'meta',
    
    -- Aggregated metrics
    total_spend DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_impressions BIGINT NOT NULL DEFAULT 0,
    total_clicks BIGINT NOT NULL DEFAULT 0,
    total_conversions INTEGER NOT NULL DEFAULT 0,
    
    -- Campaign data (JSON array of campaign objects)
    campaign_data JSONB,
    
    -- Meta tables data (for compatibility)
    meta_tables JSONB,
    
    -- Conversion metrics (detailed breakdown)
    conversion_metrics JSONB,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT monthly_summaries_client_date_platform_unique 
        UNIQUE (client_id, summary_date, platform),
    CONSTRAINT monthly_summaries_date_range_valid 
        CHECK (date_range_end >= date_range_start),
    CONSTRAINT monthly_summaries_positive_metrics 
        CHECK (total_spend >= 0 AND total_impressions >= 0 AND total_clicks >= 0 AND total_conversions >= 0)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_monthly_summaries_client_date 
    ON public.monthly_summaries (client_id, summary_date DESC);

CREATE INDEX IF NOT EXISTS idx_monthly_summaries_platform 
    ON public.monthly_summaries (platform);

CREATE INDEX IF NOT EXISTS idx_monthly_summaries_date_range 
    ON public.monthly_summaries (date_range_start, date_range_end);

-- Enable Row Level Security
ALTER TABLE public.monthly_summaries ENABLE ROW LEVEL SECURITY;

-- Create RLS policy (same as campaign_summaries)
CREATE POLICY "Users can access their own monthly summaries" ON public.monthly_summaries
    FOR ALL USING (
        client_id IN (
            SELECT id FROM clients 
            WHERE user_id = auth.uid()
        )
    );

-- Add comment
COMMENT ON TABLE public.monthly_summaries IS 'Historical monthly campaign summaries - separate from weekly data in campaign_summaries';
COMMENT ON COLUMN public.monthly_summaries.summary_date IS 'First day of the month (e.g., 2025-08-01 for August 2025)';
COMMENT ON COLUMN public.monthly_summaries.campaign_data IS 'JSON array of campaign objects with spend, impressions, clicks, conversions';
COMMENT ON COLUMN public.monthly_summaries.conversion_metrics IS 'Detailed conversion breakdown (click_to_call, reservations, etc.)';
