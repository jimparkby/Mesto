import { TelegramLogin } from './TelegramLogin';

interface Props {
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
  reason?: string;
}

/** Вход вне Telegram (браузер, APK): код от бота или гостевой вход по имени. В Telegram вход автоматический. */
export function LoginSheet({ open, onClose, onDone, reason }: Props) {
  if (!open) return null;
  return <TelegramLogin onClose={onClose} onDone={onDone} reason={reason} />;
}
