import { PaperPlaneRight, Trash } from '@phosphor-icons/react';
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import type { EventComment } from '../domain/types';
import { useToast } from '../state';
import { Avatar } from './Avatar';
import { LoginSheet } from './LoginSheet';

function ago(iso: string): string {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} ч назад`;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/** Комментарии к событию: вопросы организатору и «я буду!». Переписка один на один — в Telegram. */
export function Comments({ eventId, organizerId }: { eventId: string; organizerId: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [list, setList] = useState<EventComment[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const load = useCallback(() => api.listComments(eventId).then(setList).catch(() => {}), [eventId]);
  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!user) return setLoginOpen(true);
    const t = text.trim();
    if (!t) return;
    setBusy(true);
    try {
      const c = await api.addComment(eventId, t, user);
      setList((l) => [...l, c]);
      setText('');
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deleteComment(id);
      setList((l) => l.filter((c) => c.id !== id));
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  return (
    <section className="comments">
      <h2 className="section-label">Комментарии{list.length ? ` · ${list.length}` : ''}</h2>
      {list.length === 0 && <p className="muted">Пока нет комментариев. Спросите организатора о деталях или напишите «Я буду!».</p>}
      {list.map((c) => (
        <div key={c.id} className="comment">
          <Link to={`/user/${c.userId}`} aria-label={c.userName}>
            <Avatar name={c.userName} photoUrl={c.userPhotoUrl} size={40} />
          </Link>
          <div className="comment-bubble">
            <div className="comment-head">
              <b>
                {c.userName}
                {c.userId === organizerId && <span className="badge badge-muted">организатор</span>}
              </b>
              <span className="muted">{ago(c.createdAt)}</span>
            </div>
            <p className="prewrap">{c.text}</p>
          </div>
          {user && (c.userId === user.id || organizerId === user.id || user.role === 'admin') && (
            <button type="button" className="icon-btn" onClick={() => remove(c.id)} aria-label="Удалить комментарий">
              <Trash size={16} />
            </button>
          )}
        </div>
      ))}
      <div className="comment-input">
        <input
          className="input"
          maxLength={1000}
          placeholder={user ? 'Написать комментарий…' : 'Войдите, чтобы комментировать'}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => !user && setLoginOpen(true)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
        />
        <button type="button" className="round-action" disabled={busy || !text.trim()} onClick={send} aria-label="Отправить">
          <PaperPlaneRight size={20} weight="fill" />
        </button>
      </div>
      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} reason="Войдите, чтобы комментировать" />
    </section>
  );
}
