import { Crown, Lightning, Sparkle, UsersThree } from '@phosphor-icons/react';
import { useState } from 'react';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { platform } from '../platforms';
import { useToast } from '../state';
import { LoginSheet } from './LoginSheet';
import { Sheet } from './Sheet';

const PERKS = [
  { Glyph: Lightning, title: 'Выше в выдаче', text: 'Ваши события и профиль показываются первыми в ленте и поиске.' },
  { Glyph: Sparkle, title: 'Заметный профиль', text: 'Золотая рамка и корона — профиль выделяется среди остальных.' },
  { Glyph: UsersThree, title: 'Свои комьюнити', text: 'Создавайте тематические чаты по виду спорта, району и уровню.' },
];

function untilLabel(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Premium: что даёт и оплата Telegram Stars (в Mini App — окно оплаты Telegram, вне — бот). */
export function PremiumSheet({ open, onClose, reason }: { open: boolean; onClose: () => void; reason?: string }) {
  const { user, reloadMe } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  const buy = async () => {
    if (!user) return setLoginOpen(true);
    setBusy(true);
    try {
      const inv = await api.premiumInvoice(user);
      if (!inv.invoiceUrl && !inv.botUrl) {
        // Демо-режим: Premium включился сразу.
        await reloadMe();
        toast('Premium включён (демо — без оплаты)', 'success');
        onClose();
        return;
      }
      if (inv.invoiceUrl) {
        const status = await platform.openInvoice(inv.invoiceUrl);
        if (status === 'paid') {
          // Бот получает платёж за секунду-две — перечитываем профиль с небольшой паузой.
          setTimeout(() => reloadMe().catch(() => {}), 1500);
          toast('Спасибо! Premium активирован ⭐', 'success');
          onClose();
        } else if (status === 'failed') toast('Оплата не прошла. Попробуйте ещё раз.', 'error');
        else if (status === 'pending') toast('Завершите оплату в Telegram — Premium включится автоматически', 'info');
      } else if (inv.botUrl) {
        platform.openLink(inv.botUrl);
        toast('Оплатите в боте — Premium включится автоматически', 'info');
      }
    } catch (e) {
      toast((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const active = !!user?.premium;

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Mesto Premium">
        <div className="premium-hero">
          <Crown size={40} weight="fill" />
          {active ? <b>Premium активен до {untilLabel(user?.premiumUntil ?? null)}</b> : <b>{reason ?? 'Больше возможностей и внимания к вашим событиям'}</b>}
        </div>
        <ul className="premium-perks">
          {PERKS.map(({ Glyph, title, text }) => (
            <li key={title}>
              <span className="premium-perk-icon">
                <Glyph size={20} weight="fill" />
              </span>
              <span>
                <b>{title}</b>
                <span className="muted">{text}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="hint">Базовые функции Mesto бесплатны. Все деньги от Premium мы вкладываем в развитие и продвижение приложения.</p>
        <button className="btn btn-primary btn-arrow premium-buy" disabled={busy} onClick={buy}>
          {busy ? 'Открываем оплату…' : active ? 'Продлить на 30 дней' : 'Оформить на 30 дней'}
        </button>
        <p className="hint premium-note">Оплата через Telegram Stars. Подписка не продлевается автоматически.</p>
      </Sheet>
      <LoginSheet open={loginOpen} onClose={() => setLoginOpen(false)} reason="Войдите, чтобы оформить Premium" />
    </>
  );
}
