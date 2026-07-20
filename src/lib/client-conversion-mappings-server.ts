import { createClient } from '@supabase/supabase-js';
import {
  normalizeClientConversionMappings,
  type ClientConversionMappings,
} from './client-conversion-mappings';
import logger from './logger';

/** Load parsing mappings separately from display configuration. */
export async function loadClientConversionMappings(
  clientId: string
): Promise<ClientConversionMappings> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return {};

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase
    .from('client_dashboard_config')
    .select('conversion_mappings')
    .eq('client_id', clientId)
    .maybeSingle();

  if (error) {
    logger.warn('Could not load client conversion mappings; using parser defaults', {
      clientId,
      error: error.message,
    });
    return {};
  }

  return normalizeClientConversionMappings(data?.conversion_mappings);
}
