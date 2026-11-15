// Edge Function: уведомления о заявках из приложения (вызывается с JWT пользователя).
//  { action: 'new', event_id }               — участник подал заявку → сообщение организатору с профилем и кнопками;
//  { action: 'decided', event_id, user_id }  — организатор решил в приложении → сообщение участнику.
// Права проверяем сами: участник — только про свою заявку, решение — только организатор события.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { loadRegistration, notifyOrganizer, notifyParticipant } from '../_shared/registrations.ts';
import { cors, json } from '../_shared/telegram.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const sb = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const { data: me } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (!me.user) return json({ message: 'Нужно войти' }, 401);

  const body = await req.json().catch(() => ({}));
  const eventId = String(body.event_id ?? '');
  if (!eventId) return json({ message: 'event_id обязателен' }, 400);

  if (body.action === 'new') {
    const r = await loadRegistration({ eventId, userId: me.user.id });
    if (!r || r.status !== 'pending') return json({ ok: true, notified: false });
    return json({ ok: true, notified: await notifyOrganizer(r) });
  }

  if (body.action === 'decided') {
    const r = await loadRegistration({ eventId, userId: String(body.user_id ?? '') });
    if (!r) return json({ message: 'Заявка не найдена' }, 404);
    if (r.event.organizer_id !== me.user.id) return json({ message: 'Решать может только организатор' }, 403);
    await notifyParticipant(r);
    return json({ ok: true });
  }

  return json({ message: 'unknown action' }, 400);
});
