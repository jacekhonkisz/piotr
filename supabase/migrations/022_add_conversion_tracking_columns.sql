-- Add conversion tracking columns to campaigns table
-- Migration: 021_add_conversion_tracking_columns.sql

-- Add conversion tracking columns
ALTER TABLE campaigns 
ADD COLUMN click_to_call BIGINT DEFAULT 0,
ADD COLUMN lead BIGINT DEFAULT 0,
ADD COLUMN purchase BIGINT DEFAULT 0,
ADD COLUMN purchase_value DECIMAL(12,2) DEFAULT 0,
ADD COLUMN booking_step_1 BIGINT DEFAULT 0,
ADD COLUMN booking_step_2 BIGINT DEFAULT 0,
ADD COLUMN booking_step_3 BIGINT DEFAULT 0,
ADD COLUMN roas DECIMAL(8,2) DEFAULT 0,
ADD COLUMN cost_per_reservation DECIMAL(8,2) DEFAULT 0;

-- Add comment to document the new columns
COMMENT ON COLUMN campaigns.click_to_call IS 'Number of click-to-call events';
COMMENT ON COLUMN campaigns.lead IS 'Number of lead form submissions';
COMMENT ON COLUMN campaigns.purchase IS 'Number of purchase events';
COMMENT ON COLUMN campaigns.purchase_value IS 'Total value of purchases';
COMMENT ON COLUMN campaigns.booking_step_1 IS 'Number of booking step 1 events (initiate checkout)';
COMMENT ON COLUMN campaigns.booking_step_2 IS 'Number of booking step 2 events (add to cart)';
COMMENT ON COLUMN campaigns.booking_step_3 IS 'Number of booking step 3 events (purchase)';
COMMENT ON COLUMN campaigns.roas IS 'Return on ad spend (purchase_value / spend)';
COMMENT ON COLUMN campaigns.cost_per_reservation IS 'Cost per reservation (spend / purchase)'; 