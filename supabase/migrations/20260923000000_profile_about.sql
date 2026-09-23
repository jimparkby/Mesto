-- «О себе» в профиле: пара слов, любимые виды спорта, уровень.
alter table public.profiles
  add column if not exists bio text not null default '' check (char_length(bio) <= 300),
  add column if not exists fav_sports text[] not null default '{}' check (fav_sports <@ array[
    'football','running','basketball','volleyball','tennis','yoga',
    'cycling','workout','swimming','hockey','other']::text[]),
  add column if not exists skill_level text not null default 'any'
    check (skill_level in ('any','beginner','intermediate','advanced'));

grant update (name, photo_url, bio, fav_sports, skill_level) on public.profiles to authenticated;

-- Первая версия хранила «О себе» в user_metadata — переносим.
update public.profiles p set
  bio = left(coalesce(u.raw_user_meta_data -> 'about' ->> 'bio', ''), 300),
  fav_sports = coalesce(
    array(select jsonb_array_elements_text(u.raw_user_meta_data -> 'about' -> 'sports')), '{}'),
  skill_level = coalesce(u.raw_user_meta_data -> 'about' ->> 'level', 'any')
from auth.users u
where u.id = p.id and u.raw_user_meta_data ? 'about';
