-- Демо-события (без организатора) не должны «протухать»: раз в сутки
-- прошедшие демо-события переносятся на неделю вперёд вместе с участниками.
create extension if not exists pg_cron;

create or replace function public.roll_demo_events()
returns void
language sql
security definer set search_path = public
as $$
  update public.events
     set starts_at = starts_at + interval '7 days' * ceil(
           extract(epoch from (now() - starts_at)) / extract(epoch from interval '7 days'))
   where organizer_id is null
     and starts_at + make_interval(mins => duration_min) < now();
$$;

select cron.schedule('roll-demo-events', '0 1 * * *', 'select public.roll_demo_events()');
