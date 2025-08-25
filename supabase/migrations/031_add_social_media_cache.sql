-- Add social media insights cache table for 3-hour caching per client
CREATE TABLE social_media_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES clients(id),
  period_id TEXT NOT NULL, -- Format: "2025-08-15" (daily cache)
  cache_data JSONB NOT NULL, -- Social media insights data
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, period_id)
);

-- Add index for faster lookups
CREATE INDEX idx_social_media_cache_client_period ON social_media_cache(client_id, period_id);
CREATE INDEX idx_social_media_cache_last_updated ON social_media_cache(last_updated);

-- Add comment explaining the cache strategy
COMMENT ON TABLE social_media_cache IS 'Caches social media insights (Facebook/Instagram) per client with 3-hour refresh cycle to avoid API rate limits';
COMMENT ON COLUMN social_media_cache.period_id IS 'Daily cache key in YYYY-MM-DD format - enables 3-hour refresh cycles';
COMMENT ON COLUMN social_media_cache.cache_data IS 'JSON object containing facebookNewFollowers, instagramFollowers, instagramReach, etc.';

-- Enable Row Level Security
ALTER TABLE social_media_cache ENABLE ROW LEVEL SECURITY;

-- RLS Policy for authenticated users to access their own client data
CREATE POLICY "Users can access social media cache for their clients" ON social_media_cache
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM clients 
    WHERE clients.id = social_media_cache.client_id 
    AND clients.user_id = auth.uid()
  )
);

-- Service role can access all data
CREATE POLICY "Service role can access all social media cache" ON social_media_cache
FOR ALL USING (auth.role() = 'service_role'); 