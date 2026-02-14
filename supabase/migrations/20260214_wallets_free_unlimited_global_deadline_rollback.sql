-- 20260214_wallets_free_unlimited_global_deadline_rollback.sql
-- Emergency rollback: stop enforcing global deadline.
-- Keeps promo_config table but does not use it.

begin;

-- No data loss rollback; just keep current wallets.free_unlimited_until values and remove promo_config policies.
do $$
declare p record;
begin
  for p in (
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'promo_config'
  ) loop
    execute format('drop policy if exists %I on public.promo_config', p.policyname);
  end loop;
end $$;

alter table if exists public.promo_config disable row level security;

commit;
