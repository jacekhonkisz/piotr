-- =============================================================================
-- Supabase Database Linter Fixes (2026-05-25)
-- =============================================================================
-- Addresses every ERROR + actionable WARN reported by Supabase's database linter.
--
-- ERRORs (18):
--   * 0007 policy_exists_rls_disabled  (5 tables)        -> step 1
--   * 0010 security_definer_view       (2 views)         -> step 3
--   * 0013 rls_disabled_in_public      (10 tables)       -> step 1 + step 2
--
-- WARNs (37+):
--   * 0028/0029 anon|authenticated_security_definer_function_executable (6)
--                                                        -> step 4
--   * 0011 function_search_path_mutable (22)             -> step 5
--   * 0016 materialized_view_in_api (mv_yoy_comparisons) -> step 6
--   * 0025 public_bucket_allows_listing (client-logos)   -> step 7
--
-- Not addressed here (require dashboard toggles, NOT SQL):
--   * vulnerable_postgres_version          -> Project Settings > Infrastructure > Upgrade
--   * auth_leaked_password_protection      -> Auth > Policies > Password
--   * auth_insufficient_mfa_options        -> Auth > MFA
--
-- All server-side code uses the service role key (supabaseAdmin) which bypasses
-- RLS and GRANT EXECUTE, so this migration is safe for cron jobs and scripts.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Enable RLS on tables that already have policies but RLS is OFF
-- -----------------------------------------------------------------------------
-- These tables have existing policies that are currently INERT because RLS is
-- disabled. Turning RLS on activates them. Service role bypasses RLS, so all
-- cron / server routes that use supabaseAdmin continue to work unchanged.

ALTER TABLE public.clients                        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_month_cache            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.current_week_cache             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ads_current_month_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ads_current_week_cache  ENABLE ROW LEVEL SECURITY;

-- Optional hardening: force RLS even for table owners (defense in depth).
-- Uncomment after verifying app behavior in staging.
-- ALTER TABLE public.clients                        FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.current_month_cache            FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.current_week_cache             FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.google_ads_current_month_cache FORCE ROW LEVEL SECURITY;
-- ALTER TABLE public.google_ads_current_week_cache  FORCE ROW LEVEL SECURITY;


-- -----------------------------------------------------------------------------
-- 2. Drop backup tables sitting in the public schema
-- -----------------------------------------------------------------------------
-- These were created during one-off backfills (Nov 18 2025 and the token-copy
-- migration). They have no RLS, no policies, and are exposed via PostgREST.
-- The clients_backup_* tables almost certainly contain copies of meta_access_token,
-- system_user_token and google_ads_refresh_token columns -- treat as a credential
-- leak until removed.
--
-- If you still need a snapshot for auditing, run pg_dump locally first, then
-- drop. Alternatively replace each DROP with:
--   CREATE SCHEMA IF NOT EXISTS archive;
--   ALTER TABLE public.<name> SET SCHEMA archive;
--   REVOKE ALL ON archive.<name> FROM anon, authenticated;

DROP TABLE IF EXISTS public.clients_backup_before_token_copy;
DROP TABLE IF EXISTS public.clients_backup_correct_token;
DROP TABLE IF EXISTS public.campaign_summaries_backup_20251118;
DROP TABLE IF EXISTS public.campaign_summaries_backup_20251118_all_clients;
DROP TABLE IF EXISTS public.campaign_summaries_complete_backup_20251118;


-- -----------------------------------------------------------------------------
-- 3. Replace SECURITY DEFINER views with SECURITY INVOKER
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER views run with the view owner's permissions, bypassing the
-- caller's RLS. We switch to security_invoker = true so the underlying tables'
-- RLS policies apply to whoever queries the view.
--
-- ALTER VIEW ... SET (security_invoker = true) preserves the existing definition
-- and is non-destructive. If the views were created on an older Postgres that
-- doesn't support the option, fall back to CREATE OR REPLACE VIEW with the same
-- SELECT body.

ALTER VIEW public.token_health_overview SET (security_invoker = true);
ALTER VIEW public.v_data_quality_issues SET (security_invoker = true);

-- Make sure anon cannot read these (admin-only dashboards).
REVOKE ALL ON public.token_health_overview FROM anon;
REVOKE ALL ON public.v_data_quality_issues FROM anon;
GRANT SELECT ON public.token_health_overview TO authenticated;
GRANT SELECT ON public.v_data_quality_issues TO authenticated;


-- -----------------------------------------------------------------------------
-- 4. Lock down SECURITY DEFINER RPC functions (lints 0028 / 0029)
-- -----------------------------------------------------------------------------
-- These functions run with owner (superuser) privileges and were callable by
-- the anon / authenticated roles via /rest/v1/rpc/<name>. None of them are
-- legitimately reached from the browser in our app:
--
--   * automated_cache_cleanup / cleanup_old_data are called from a Node script
--     (scripts/verify-13-month-retention.js) using the service role key, which
--     bypasses GRANT EXECUTE checks. Revoking from anon/authenticated is safe.
--   * handle_new_user is the auth.users INSERT trigger body. It must remain
--     SECURITY DEFINER so the trigger can write to public.profiles, but it
--     should NEVER be callable as an RPC.
--   * get_recent_logs / get_storage_stats / get_cache_performance_stats are
--     admin telemetry; admin dashboards should route through a server endpoint
--     using the service role, not direct RPC from the browser.
--   * validate_year_over_year_data is a long-running aggregation; DoS risk.

-- Loop by oid so overloads and unknown signatures don't break us.
DO $$
DECLARE
  target_name text;
  fn_oid oid;
  target_names text[] := ARRAY[
    'automated_cache_cleanup',
    'get_cache_performance_stats',
    'get_recent_logs',
    'get_storage_stats',
    'handle_new_user',
    'validate_year_over_year_data'
  ];
BEGIN
  FOREACH target_name IN ARRAY target_names LOOP
    FOR fn_oid IN
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = target_name
    LOOP
      EXECUTE format(
        'REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated, public',
        fn_oid::regprocedure
      );
      RAISE NOTICE 'Revoked EXECUTE on %', fn_oid::regprocedure;
    END LOOP;
  END LOOP;
END
$$;

-- service_role keeps EXECUTE implicitly (it bypasses these checks), so the
-- server-side cron / scripts continue to work unchanged.


-- -----------------------------------------------------------------------------
-- 5. Pin search_path on every function (lint 0011)
-- -----------------------------------------------------------------------------
-- For SECURITY DEFINER functions this closes a real privilege-escalation hole.
-- For SECURITY INVOKER functions it's hygiene + protection against future
-- promotion to DEFINER. We set 'public, pg_temp'.
--
-- We use a DO block that looks each function up by oid via pg_proc, so we
-- don't need to know argument signatures and overloads are handled correctly.
-- Functions that don't exist in this project are silently skipped.

DO $$
DECLARE
  target_name text;
  fn_oid oid;
  target_names text[] := ARRAY[
    'update_token_health_status',
    'update_executive_summaries_updated_at',
    'cleanup_old_campaign_summaries',
    'cleanup_old_cache',
    'cleanup_old_weekly_cache',
    'cleanup_old_google_ads_cache',
    'cleanup_old_daily_kpi_data',
    'get_campaign_summary',
    'get_storage_stats',
    'get_recent_logs',
    'upsert_daily_kpi_data',
    'get_daily_kpi_for_carousel',
    'cleanup_old_data',
    'cleanup_old_sent_reports',
    'validate_year_over_year_data',
    'get_cache_performance_stats',
    'automated_cache_cleanup',
    'update_email_template_timestamp',
    'validate_funnel_logic',
    'get_yoy_comparison',
    'handle_new_user',
    'update_updated_at_column'
  ];
BEGIN
  FOREACH target_name IN ARRAY target_names LOOP
    FOR fn_oid IN
      SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = target_name
    LOOP
      EXECUTE format(
        'ALTER FUNCTION %s SET search_path = public, pg_temp',
        fn_oid::regprocedure
      );
      RAISE NOTICE 'Pinned search_path on %', fn_oid::regprocedure;
    END LOOP;
  END LOOP;
END
$$;


-- -----------------------------------------------------------------------------
-- 6. Revoke API access on materialized view (lint 0016)
-- -----------------------------------------------------------------------------
-- mv_yoy_comparisons has no RLS (materialized views can't) and is not used by
-- any browser code. Revoke from anon/authenticated; service role keeps access.

REVOKE ALL ON public.mv_yoy_comparisons FROM anon, authenticated;


-- -----------------------------------------------------------------------------
-- 7. Tighten client-logos storage bucket (lint 0025)
-- -----------------------------------------------------------------------------
-- The "Allow public read access to client logos" policy lets anyone LIST every
-- object in the bucket. Public URLs (used by upload-logo route via getPublicUrl)
-- don't need this policy -- they work because the bucket is marked public.
-- Drop the broad SELECT policy.

DROP POLICY IF EXISTS "Allow public read access to client logos" ON storage.objects;


-- -----------------------------------------------------------------------------
-- 8. Sanity checks (run manually after migration)
-- -----------------------------------------------------------------------------
-- SELECT relname, relrowsecurity, relforcerowsecurity
-- FROM pg_class
-- WHERE relnamespace = 'public'::regnamespace
--   AND relname IN (
--     'clients','current_month_cache','current_week_cache',
--     'google_ads_current_month_cache','google_ads_current_week_cache'
--   );
--
-- SELECT schemaname, viewname, viewowner,
--        (pg_catalog.pg_get_viewdef(c.oid))::text AS def,
--        c.reloptions
-- FROM pg_views v JOIN pg_class c ON c.relname = v.viewname
-- WHERE v.schemaname = 'public'
--   AND v.viewname IN ('token_health_overview','v_data_quality_issues');
