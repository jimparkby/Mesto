-- Вход в APK и браузере через код от бота.
-- APK получает token → пользователь открывает t.me/<bot>?start=login_<token> →
-- бот присылает 4-значный код → APK отправляет token + код и получает сессию.
-- Таблицу читают и пишут только Edge Functions (service role), поэтому политик RLS нет.

create table public.tg_login_requests (
  token        text primary key,
  created_at   timestamptz not null default now(),
  chat_id      bigint,
  tg_user      jsonb,
  code_hash    text,
  code_sent_at timestamptz,
  attempts     int not null default 0
);

alter table public.tg_login_requests enable row level security;
