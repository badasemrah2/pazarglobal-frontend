-- 20260214_fix_function_search_path.sql
-- Goal: Resolve Supabase Advisor warning `function_search_path_mutable` by pinning search_path.
-- Rationale: Prevents object-name hijacking via mutable search_path (especially important for SECURITY DEFINER functions).

begin;

-- Use a conservative search_path that supports Supabase extensions while avoiding surprises.
-- Note: keep pg_temp last.

alter function public.increment_query_count(p_product_key text)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.cleanup_expired_snapshots()
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.credit_wallet(p_user uuid, p_amount_bigint bigint, p_kind text, p_reference text, p_metadata jsonb)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.check_session(p_phone text, p_session_token uuid)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.update_active_drafts_updated_at()
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.verify_pin(p_phone text, p_pin text)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.check_rate_limit(p_user_id uuid, p_phone text, p_action text, p_max_allowed integer)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.update_updated_at_column()
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.calculate_expiry_date(p_category text)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.cleanup_old_notifications()
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.register_user(p_user_id uuid, p_phone text, p_email text, p_name text, p_pin_hash text, p_created_at timestamp with time zone)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.get_user_by_phone(p_phone text)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.register_user_pin(p_user_id uuid, p_phone text, p_pin_hash text)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.cleanup_expired_sessions()
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.normalize_phone_on_insert()
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.link_phone_to_profile(p_user_id uuid, p_phone text)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.is_session_valid(p_phone text, p_session_token text)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.set_user_context(p_user_id text)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.handle_new_user()
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.reset_user_pin(p_user_id uuid)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.match_products(query_embedding vector, match_threshold double precision, match_count integer)
  set search_path = pg_catalog, public, extensions, pg_temp;

alter function public.log_audit(p_user_id uuid, p_phone text, p_action text, p_resource_type text, p_resource_id uuid, p_response_status text, p_error_message text, p_request_data jsonb)
  set search_path = pg_catalog, public, extensions, pg_temp;

commit;
