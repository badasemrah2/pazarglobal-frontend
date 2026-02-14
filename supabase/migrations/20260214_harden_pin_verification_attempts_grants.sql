-- 20260214_harden_pin_verification_attempts_grants.sql
-- Goal: Remove unnecessary broad GRANTs from pin_verification_attempts.
-- RLS is enabled and there are no policies, but tightening GRANTs reduces attack surface and noise.

begin;

revoke all on table public.pin_verification_attempts from anon, authenticated, public;

-- Keep backend/service access.
grant select, insert, update, delete on table public.pin_verification_attempts to service_role;

commit;
