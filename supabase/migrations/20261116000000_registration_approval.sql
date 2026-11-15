-- Запись по одобрению организатора.
-- Участник подаёт заявку (pending) → организатору приходит сообщение в боте с профилем →
-- он принимает (approved) или отклоняет (rejected). Место занимает только принятая заявка.
-- Организатор своего события и события без организатора (импорт) — сразу approved.

alter table public.registrations
  add column if not exists status text not null default 'approved'
    check (status in ('pending', 'approved', 'rejected')),
  add column if not exists decided_at timestamptz;

-- Короткий номер заявки — для кнопок в боте (callback_data не длиннее 64 байт, два uuid не влезают).
alter table public.registrations
  add column if not exists id bigint generated always as identity;
create unique index if not exists registrations_id_key on public.registrations (id);

create or replace function public.registrations_before_insert()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ev public.events;
begin
  select * into ev from public.events where id = new.event_id for update;
  if not found then
    raise exception 'Событие не найдено';
  end if;
  if ev.status <> 'published' then
    raise exception 'Запись на событие закрыта';
  end if;
  if ev.starts_at + make_interval(mins => ev.duration_min) < now() then
    raise exception 'Событие уже прошло';
  end if;
  if ev.registered_count >= ev.capacity then
    raise exception 'Мест больше нет';
  end if;
  -- Статус ставит сервер, а не клиент.
  if ev.organizer_id is null or ev.organizer_id = new.user_id then
    new.status := 'approved';
    new.decided_at := now();
    update public.events set registered_count = registered_count + 1 where id = new.event_id;
  else
    new.status := 'pending';
    new.decided_at := null;
  end if;
  return new;
end;
$$;

-- Решение организатора: принятая заявка занимает место, снятое одобрение его освобождает.
create or replace function public.registrations_before_update()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  ev public.events;
begin
  if new.event_id <> old.event_id or new.user_id <> old.user_id then
    raise exception 'Нельзя менять заявку';
  end if;
  if new.status = old.status then
    return new;
  end if;
  select * into ev from public.events where id = new.event_id for update;
  if new.status = 'approved' then
    if ev.registered_count >= ev.capacity then
      raise exception 'Мест больше нет';
    end if;
    update public.events set registered_count = registered_count + 1 where id = new.event_id;
  elsif old.status = 'approved' then
    update public.events set registered_count = greatest(registered_count - 1, 0) where id = new.event_id;
  end if;
  new.decided_at := now();
  return new;
end;
$$;

drop trigger if exists registrations_before_update on public.registrations;
create trigger registrations_before_update
  before update on public.registrations
  for each row execute function public.registrations_before_update();

create or replace function public.registrations_after_delete()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if old.status = 'approved' then
    update public.events
       set registered_count = greatest(registered_count - 1, 0)
     where id = old.event_id;
  end if;
  return old;
end;
$$;

-- Решать по заявкам может организатор события (и админ).
drop policy if exists "organizer decides registrations" on public.registrations;
create policy "organizer decides registrations" on public.registrations
  for update to authenticated
  using (
    exists (select 1 from public.events e where e.id = event_id and (e.organizer_id = auth.uid() or public.is_admin()))
  )
  with check (
    exists (select 1 from public.events e where e.id = event_id and (e.organizer_id = auth.uid() or public.is_admin()))
  );
revoke update on public.registrations from anon, authenticated;
grant update (status) on public.registrations to authenticated;

notify pgrst, 'reload schema';
