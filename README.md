# СпортРядом

Любительские тренировки и игры рядом с тобой в Минске: находи события на карте, записывайся в один клик, создавай свои и собирай команду.

MVP для [Space University 2026](https://www.park.by/startup/calendar/space-university/) (Парк высоких технологий).

**Один веб-код — две оболочки:**

```
React + TypeScript + Vite + Mapbox
        ├── Telegram Mini App (HTTPS, открывается из бота)
        └── Android APK (Capacitor)
Общий бэкенд: Supabase (PostgreSQL + Auth + Edge Functions)
```

## Возможности MVP

- Лента событий с группировкой по дням, поиск, фильтры: вид спорта, дата, уровень, бесплатные, радиус от меня
- Карта событий (Mapbox; без токена — MapLibre + OpenStreetMap)
- Карточка события: участники, места, маршрут, «Поделиться» (в Telegram — ссылка на Mini App с открытием конкретного события)
- Запись / отмена записи, контроль свободных мест на сервере
- Создание события с выбором точки на карте
- Профиль: «Я иду», «Мои события», история
- Модерация событий для админа
- Вход: автоматически через Telegram (`initData` проверяется на сервере) или по имени в браузере/APK
- **Демо-режим**: без ключей Supabase всё работает на данных в `localStorage` — удобно показывать жюри

## Структура

```
src/
  api/            контракт Backend + реализации: supabaseBackend, mock/demoBackend
  auth/           AuthContext — адаптер входа (telegram / guest)
  domain/         типы, виды спорта, фильтры, форматирование — без зависимостей от платформы
  platforms/      telegram.ts, native.ts (Capacitor), web.ts — всё платформенное здесь
  components/     EventCard, FilterBar, MapView, Sheet, Layout…
  pages/          Home, Map, Event, CreateEvent, Profile, Admin
supabase/
  migrations/     схема БД, триггеры, RLS
  functions/      telegram-auth (вход по initData), bot (webhook бота)
  seed.sql        демо-события
android/          Capacitor-проект
```

Компоненты и страницы не знают про Telegram и Capacitor — только про интерфейс `Platform`.

## Быстрый старт

```bash
npm install
npm run dev          # http://localhost:5173 — демо-режим
```

Для реального бэкенда скопируйте `.env.example` в `.env` и заполните переменные.

## Supabase

Боевой проект: `sport-ryadom` (ref `tztrfetnjlvjebdrrydd`, eu-central-1). Схема, демо-данные (15 событий + 18 демо-участников),
функции `telegram-auth` и `bot`, webhook бота и гостевой вход уже настроены. Демо-события раз в сутки
переносятся на неделю вперёд (pg_cron `roll-demo-events`), так что лента не пустеет.

Настройка с нуля:

1. Создайте проект на supabase.com, включите **Anonymous sign-ins** (Authentication → Providers).
2. Примените схему и демо-данные:
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   psql "<connection string>" -f supabase/seed.sql   # или вставьте в SQL Editor
   ```
3. Функции и секреты:
   ```bash
   npx supabase secrets set TELEGRAM_BOT_TOKEN=... TG_AUTH_SECRET=<случайная строка> \
     MINI_APP_URL=https://sport-minsk.vercel.app/ TELEGRAM_WEBHOOK_SECRET=<случайная строка>
   npx supabase functions deploy telegram-auth --no-verify-jwt
   npx supabase functions deploy bot --no-verify-jwt
   ```
4. Назначить админа: `update profiles set role = 'admin' where name = '...';`

## Telegram Mini App

1. Создайте бота в [@BotFather](https://t.me/BotFather), затем `/newapp` — укажите URL фронтенда (Vercel, см. ниже). Получится ссылка `https://t.me/<bot>/<app>` — её в `VITE_TG_APP_LINK`.
2. `/setmenubutton` — кнопка «СпортРядом» с тем же URL.
3. Webhook бота:
   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d url=https://<ref>.supabase.co/functions/v1/bot \
     -d secret_token=<TELEGRAM_WEBHOOK_SECRET>
   ```

Ссылка на конкретное событие: `https://t.me/<bot>/<app>?startapp=event_<id>`.

## Хостинг (Vercel)

Фронтенд живёт на Vercel: https://sport-minsk.vercel.app/ — проект подключён к репозиторию и
пересобирается при каждом push в `main`. Переменные окружения сборки (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `VITE_MAPBOX_TOKEN`, `VITE_TG_APP_LINK`) задаются в настройках проекта на Vercel.

## Android APK

**Без Android Studio:** workflow `.github/workflows/android.yml` собирает debug-APK при каждом push — скачать в **Actions → Android APK → Artifacts**.

**Локально** (нужны JDK 21 и Android SDK):

```bash
npm run android:sync    # сборка веба + копирование в android/
npm run android:open    # открыть в Android Studio
npm run android:apk     # или сразу собрать debug-APK
```

Иконки и сплеш генерируются из `assets/`: `npx capacitor-assets generate --android`.

## Дальше по плану

- Уведомления о записи и напоминания за час через бота (Supabase cron / n8n)
- Вход в APK через Telegram Login / email
- Отдельная админ-панель (Next.js), верификация организаторов
- Оплата участия, рейтинг организаторов, повторяющиеся события
