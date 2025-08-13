-- Migration: Add conversion metrics columns to campaign_summaries table
-- This enables proper aggregation and storage of weekly conversion data
-- at the summary level instead of relying on campaign-level aggregation

-- Add conversion metrics columns to campaign_summaries table
ALTER TABLE campaign_summaries 
ADD COLUMN IF NOT EXISTS click_to_call BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS email_contacts BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS booking_step_1 BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS reservations BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS reservation_value DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS booking_step_2 BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS roas DECIMAL(8,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS cost_per_reservation DECIMAL(8,2) DEFAULT 0;

-- Add comments to document the conversion metrics
COMMENT ON COLUMN campaign_summaries.click_to_call IS 'Total click-to-call events for the period';
COMMENT ON COLUMN campaign_summaries.email_contacts IS 'Total email contact events for the period';
COMMENT ON COLUMN campaign_summaries.booking_step_1 IS 'Total booking step 1 events (initiate checkout) for the period';
COMMENT ON COLUMN campaign_summaries.reservations IS 'Total completed reservations for the period';
COMMENT ON COLUMN campaign_summaries.reservation_value IS 'Total value of all reservations for the period';
COMMENT ON COLUMN campaign_summaries.booking_step_2 IS 'Total booking step 2 events (add to cart) for the period';
COMMENT ON COLUMN campaign_summaries.roas IS 'Return on Ad Spend for the period';
COMMENT ON COLUMN campaign_summaries.cost_per_reservation IS 'Average cost per reservation for the period';

-- Create function to calculate and backfill conversion metrics for existing summaries
CREATE OR REPLACE FUNCTION backfill_conversion_metrics()
RETURNS void AS $$
DECLARE
    summary_record RECORD;
    campaign_record JSONB;
    total_click_to_call BIGINT;
    total_email_contacts BIGINT;
    total_booking_step_1 BIGINT;
    total_reservations BIGINT;
    total_reservation_value DECIMAL(12,2);
    total_booking_step_2 BIGINT;
    calculated_roas DECIMAL(8,2);
    calculated_cost_per_reservation DECIMAL(8,2);
BEGIN
    -- Process each existing summary that has null conversion metrics
    FOR summary_record IN 
        SELECT id, client_id, summary_type, summary_date, campaign_data, total_spend
        FROM campaign_summaries 
        WHERE click_to_call IS NULL OR click_to_call = 0
    LOOP
        -- Initialize totals
        total_click_to_call := 0;
        total_email_contacts := 0;
        total_booking_step_1 := 0;
        total_reservations := 0;
        total_reservation_value := 0;
        total_booking_step_2 := 0;
        
        -- Aggregate conversion metrics from campaign_data JSONB array
        IF summary_record.campaign_data IS NOT NULL THEN
            FOR campaign_record IN SELECT * FROM jsonb_array_elements(summary_record.campaign_data)
            LOOP
                total_click_to_call := total_click_to_call + COALESCE((campaign_record->>'click_to_call')::BIGINT, 0);
                total_email_contacts := total_email_contacts + COALESCE((campaign_record->>'email_contacts')::BIGINT, 0);
                total_booking_step_1 := total_booking_step_1 + COALESCE((campaign_record->>'booking_step_1')::BIGINT, 0);
                total_reservations := total_reservations + COALESCE((campaign_record->>'reservations')::BIGINT, 0);
                total_reservation_value := total_reservation_value + COALESCE((campaign_record->>'reservation_value')::DECIMAL(12,2), 0);
                total_booking_step_2 := total_booking_step_2 + COALESCE((campaign_record->>'booking_step_2')::BIGINT, 0);
            END LOOP;
        END IF;
        
        -- Calculate derived metrics
        IF summary_record.total_spend > 0 AND total_reservation_value > 0 THEN
            calculated_roas := total_reservation_value / summary_record.total_spend;
        ELSE
            calculated_roas := 0;
        END IF;
        
        IF total_reservations > 0 AND summary_record.total_spend > 0 THEN
            calculated_cost_per_reservation := summary_record.total_spend / total_reservations;
        ELSE
            calculated_cost_per_reservation := 0;
        END IF;
        
        -- Update the summary with calculated conversion metrics
        UPDATE campaign_summaries 
        SET 
            click_to_call = total_click_to_call,
            email_contacts = total_email_contacts,
            booking_step_1 = total_booking_step_1,
            reservations = total_reservations,
            reservation_value = total_reservation_value,
            booking_step_2 = total_booking_step_2,
            roas = calculated_roas,
            cost_per_reservation = calculated_cost_per_reservation,
            last_updated = NOW()
        WHERE id = summary_record.id;
        
        RAISE NOTICE 'Backfilled conversion metrics for summary ID % (% %): % reservations, % value', 
            summary_record.id, 
            summary_record.summary_type, 
            summary_record.summary_date,
            total_reservations,
            total_reservation_value;
    END LOOP;
    
    RAISE NOTICE 'Conversion metrics backfill completed successfully';
END;
$$ LANGUAGE plpgsql;

-- Run the backfill function
SELECT backfill_conversion_metrics();

-- Drop the temporary function
DROP FUNCTION backfill_conversion_metrics();

-- Create index for efficient conversion metrics queries
CREATE INDEX IF NOT EXISTS idx_campaign_summaries_conversions 
ON campaign_summaries(client_id, summary_type, reservations DESC, reservation_value DESC); 