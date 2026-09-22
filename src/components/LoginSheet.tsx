import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../state';
import { Sheet } from './Sheet';

interface Props {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  reason?: string;
}

/** Вход вне Telegram (браузер, APK): для MVP достаточно имени. */
export function LoginSheet({ open, onClose, onDone, reason }: Props) {
  const { signInAsGuest } = useAuth();
  const toast = useToast();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    try {
      await signInAsGuest(name);
      toast(`Привет, ${name.trim()}!`, 'success');
      onClose();
      onDone?.();
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Как вас зовут?">
      <p className="muted">{reason ?? 'Имя увидят организатор и другие участники.'}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="input"
          autoFocus
          placeholder="Имя"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button className="btn btn-primary btn-block" disabled={busy || name.trim().length < 2}>
          {busy ? 'Входим…' : 'Продолжить'}
        </button>
      </form>
      <p className="hint">В Telegram вход происходит автоматически.</p>
    </Sheet>
  );
}
