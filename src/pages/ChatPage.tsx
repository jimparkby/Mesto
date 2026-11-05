import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CaretLeft, ChatCircle } from '@phosphor-icons/react';
import { useAuth } from '../auth/AuthContext';
import { Icon } from '../components/Icon';
import { useToast } from '../state';

interface Message {
  id: string;
  text: string;
  sender: 'me' | 'them';
  time: string;
  status: 'sending' | 'sent' | 'delivered' | 'read';
}

const INITIAL_MESSAGES: Message[] = [
  { id: '1', text: 'Привет! Кто идёт на футбол завтра?', sender: 'them', time: '14:20', status: 'read' },
  { id: '2', text: 'Я могу! В какое время встреча?', sender: 'me', time: '14:22', status: 'read' },
  { id: '3', text: 'В 18:00 на стадионе „Динамо“', sender: 'them', time: '14:25', status: 'read' },
  { id: '4', text: 'Отлично, буду. Кто ещё записался?', sender: 'me', time: '14:28', status: 'read' },
];

const MOCK_PARTNER = { name: 'Алексей Волков', photoUrl: '' as string | null, online: true };

export function ChatPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [messages, setMessages] = useState<Message[]>([...INITIAL_MESSAGES]);
  const [input, setInput] = useState('');

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const now = new Date();
    const time = `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`;
    const msg: Message = { id: String(Date.now()), text, sender: 'me', time, status: 'sending' };
    setMessages((prev) => [...prev, msg]);
    setInput('');
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: 'delivered' } : m)),
      );
      toast('Сообщение отправлено', 'success');
    }, 600);
  };

  const keyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="page">
      <header className="chat-head">
        <button className="chat-back" onClick={() => navigate(-1)} aria-label="Назад">
          <CaretLeft size={24} weight="bold" />
        </button>
        <div className="chat-head-info">
          <div className="chat-avatar">
            {MOCK_PARTNER.photoUrl ? (
              <img src={MOCK_PARTNER.photoUrl} alt={MOCK_PARTNER.name} />
            ) : (
              <span className="avatar-initials">{MOCK_PARTNER.name.split(' ').map((p) => p[0]).join('')}</span>
            )}
          </div>
          <div className="chat-head-text">
            <h1 className="chat-title">{MOCK_PARTNER.name}</h1>
            <span className={`chat-status ${MOCK_PARTNER.online ? 'online' : ''}`}>
              {MOCK_PARTNER.online ? 'В сети' : 'Не в сети'}
            </span>
          </div>
        </div>
        <button className="chat-more" aria-label="Ещё">
          <Icon name="dots" size={22} />
        </button>
      </header>

      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={`chat-message ${m.sender}`}>
            {m.sender === 'them' && (
              <Avatar name={MOCK_PARTNER.name} photoUrl={MOCK_PARTNER.photoUrl} size={32} />
            )}
            <div className="chat-bubble">
              <p className="chat-text">{m.text}</p>
              <div className="chat-meta">
                <span className="chat-time">{m.time}</span>
                {m.sender === 'me' && (
                  <>
                    <span className={`chat-status-dot ${m.status}`} />
                    <span className="chat-status-text">
                      {m.status === 'sending' ? 'Отправляется…' : m.status === 'sent' ? 'Отправлено' : m.status === 'delivered' ? 'Доставлено' : 'Прочитано'}
                    </span>
                  </>
                )}
              </div>
            </div>
            {m.sender === 'me' && (
              <Avatar name={user?.name ?? 'Вы'} photoUrl={user?.photoUrl ?? null} size={32} />
            )}
          </div>
        ))}
        <div className="chat-spacer" />
      </div>

      <div className="chat-input-area">
        <div className="chat-input-wrap">
          <textarea
            className="chat-input"
            placeholder="Напишите сообщение…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={keyDown}
            rows={1}
          />
          <button className="chat-send" disabled={!input.trim()} onClick={send} aria-label="Отправить">
            <ChatCircle size={22} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, photoUrl, size = 36 }: { name: string; photoUrl?: string | null; size?: number }) {
  const COLORS = ['#16a34a', '#0ea5e9', '#f97316', '#a855f7', '#ef4444', '#eab308', '#06b6d4', '#3b82f6'];
  function hash(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  const style = { width: size, height: size, fontSize: size * 0.42 };
  if (photoUrl) return <img className="avatar" src={photoUrl} alt={name} style={style} referrerPolicy="no-referrer" />;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
  return (
    <span className="avatar" style={{ ...style, background: COLORS[hash(name) % COLORS.length] }} aria-label={name}>
      {initials || '?'}
    </span>
  );
}
