-- Профиль тренера: включается в настройках профиля, события тренера помечаются «Тренер».
alter table public.profiles
  add column if not exists is_coach boolean not null default false,
  add column if not exists coach_bio text not null default '' check (char_length(coach_bio) <= 500),
  add column if not exists coach_sports text[] not null default '{}' check (coach_sports <@ array[
    'football','running','basketball','volleyball','tennis','yoga',
    'cycling','workout','swimming','hockey','other']::text[]),
  add column if not exists coach_years int not null default 0 check (coach_years between 0 and 60);

grant update (name, photo_url, bio, fav_sports, skill_level, is_coach, coach_bio, coach_sports, coach_years)
  on public.profiles to authenticated;
