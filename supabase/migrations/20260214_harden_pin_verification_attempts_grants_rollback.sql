-- 20260214_harden_pin_verification_attempts_grants_rollback.sql
-- Emergency rollback: re-grant broad privileges to anon/authenticated.

begin;

grant select, insert, update, delete on table public.pin_verification_attempts to anon, authenticated;

commit;
