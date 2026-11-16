-- Premium отменён: комьюнити может создать любой вошедший пользователь,
-- оплаты Stars, выдача Premium админом и срок Premium в профиле больше не нужны.

drop policy if exists "premium creates communities" on public.communities;
drop policy if exists "members create communities" on public.communities;
create policy "members create communities" on public.communities
  for insert to authenticated
  with check (created_by = auth.uid() and members_count = 0);

drop function if exists public.grant_premium(uuid, int, text, int);
drop function if exists public.admin_set_premium(uuid, int);
drop function if exists public.is_premium(uuid);
drop table if exists public.premium_payments;
alter table public.profiles drop column if exists premium_until;

notify pgrst, 'reload schema';
