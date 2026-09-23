import { CaretLeft, TelegramLogo } from '@phosphor-icons/react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TelegramLoginRequest } from '../api';
import { useAuth } from '../auth/AuthContext';
import { platform } from '../platforms';
import { useToast } from '../state';

const CODE_LENGTH = 4;
const RESEND_COOLDOWN_SEC = 30;

interface Props {
  onClose: () => void;
  onDone?: () => void;
  /** Подзаголовок первого экрана, например зачем нужен вход. */
  reason?: string;
}

/**
 * Вход вне Telegram (APK, браузер) по макету Login / Verification:
 * «Войти через Telegram» → бот присылает 4-значный код → ввод кода.
 * Запасной вариант — гостевой вход по имени.
 */
export function TelegramLogin({ onClose, onDone, reason }: Props) {
  const { startTelegramLogin, resendTelegramCode, signInWithTelegramCode, signInAsGuest } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState<'login' | 'guest' | 'code'>('login');
  const [request, setRequest] = useState<TelegramLoginRequest | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeInput = useRef<HTMLInputElement>(null);

  const botLink = request ? `https://t.me/${request.bot}?start=login_${request.token}` : '';

  const back = () => {
    setError(null);
    if (step === 'login') onClose();
    else setStep('login');
  };

  useEffect(() => platform.setBackHandler(back));

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Вернулись из Telegram — сразу ставим курсор в поле кода.
  useEffect(() => {
    if (step !== 'code') return;
    const focus = () => document.visibilityState === 'visible' && codeInput.current?.focus();
    document.addEventListener('visibilitychange', focus);
    return () => document.removeEventListener('visibilitychange', focus);
  }, [step]);

  const finish = (greeting: string) => {
    toast(greeting, 'success');
    onClose();
    onDone?.();
  };

  const startTelegram = async () => {
    setBusy(true);
    setError(null);
    try {
      // Повторное нажатие переиспользует запрос: бот уже мог прислать по нему код.
      const req = request ?? (await startTelegramLogin());
      setRequest(req);
      setCode('');
      setStep('code');
      setCooldown(RESEND_COOLDOWN_SEC);
      platform.openLink(`https://t.me/${req.bot}?start=login_${req.token}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value = code) => {
    if (!request || value.length !== CODE_LENGTH || busy) return;
    setBusy(true);
    setError(null);
    try {
      const u = await signInWithTelegramCode(request.token, value);
      finish(`Привет, ${u.name}!`);
    } catch (e) {
      platform.haptic('error');
      setError((e as Error).message);
      setCode('');
      codeInput.current?.focus();
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (!request || cooldown > 0) return;
    setError(null);
    try {
      await resendTelegramCode(request.token);
      setCooldown(RESEND_COOLDOWN_SEC);
      toast('Новый код отправлен в Telegram', 'success');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(botLink);
      toast('Ссылка скопирована', 'success');
    } catch {
      toast(botLink, 'info');
    }
  };

  const enterAsGuest = async () => {
    if (name.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      await signInAsGuest(name);
      finish(`Привет, ${name.trim()}!`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const top = (
    <div className="auth-top">
      <button className="auth-back" onClick={back} aria-label="Назад">
        <CaretLeft size={24} weight="bold" />
      </button>
      {step === 'code' && (
        <button className="auth-top-link" onClick={() => platform.openLink(botLink)}>
          Открыть бота
        </button>
      )}
    </div>
  );

  let body;
  if (step === 'code') {
    body = (
      <>
        <h1 className="auth-title auth-center">Введите код</h1>
        <p className="auth-sub auth-center">
          Бот <b>@{request?.bot}</b> пришлёт 4-значный код, когда вы нажмёте «Старт» в чате с ним
        </p>

        <label className="auth-code" onClick={() => codeInput.current?.focus()}>
          <input
            ref={codeInput}
            className="auth-code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            value={code}
            aria-label="Код из Telegram"
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, '').slice(0, CODE_LENGTH);
              setCode(v);
              setError(null);
              if (v.length === CODE_LENGTH) verify(v);
            }}
          />
          {Array.from({ length: CODE_LENGTH }, (_, i) => (
            <span
              key={i}
              className={`auth-code-cell${code[i] ? ' is-filled' : ''}${i === code.length ? ' is-active' : ''}${error ? ' is-error' : ''}`}
            >
              {code[i] ?? ''}
            </span>
          ))}
        </label>
        {error && <p className="auth-error auth-center">{error}</p>}

        <button className="btn btn-peach auth-main-btn" disabled={busy || code.length !== CODE_LENGTH} onClick={() => verify()}>
          {busy ? 'Проверяем…' : 'Продолжить'}
        </button>
        <button className="auth-link" onClick={resend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Прислать код ещё раз через ${cooldown} с` : 'Прислать код ещё раз'}
        </button>

        <div className="onb-spacer" />
        <p className="auth-hint auth-center">
          Telegram на другом устройстве?{' '}
          <button className="auth-inline-link" onClick={copyLink}>
            Скопировать ссылку на бота
          </button>
        </p>
      </>
    );
  } else if (step === 'guest') {
    body = (
      <form
        className="auth-form"
        onSubmit={(e) => {
          e.preventDefault();
          enterAsGuest();
        }}
      >
        <h1 className="auth-title">Как вас зовут?</h1>
        <p className="auth-sub">Имя увидят организатор и другие участники.</p>
        <input
          className="auth-input"
          autoFocus
          placeholder="Имя"
          maxLength={40}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="auth-hint">Гостевой аккаунт живёт только на этом устройстве.</p>
        {error && <p className="auth-error">{error}</p>}
        <div className="onb-spacer" />
        <button className="btn btn-peach btn-arrow" disabled={busy || name.trim().length < 2}>
          {busy ? 'Входим…' : 'Продолжить'}
        </button>
      </form>
    );
  } else {
    body = (
      <>
        <h1 className="auth-title">Добро пожаловать.</h1>
        <p className="auth-sub">{reason ?? 'Войдите в свой аккаунт'}</p>

        <div className="auth-tg-card">
          <span className="auth-tg-icon">
            <TelegramLogo size={26} weight="fill" />
          </span>
          <div>
            <b>Через Telegram</b>
            <span>Тот же аккаунт, что в мини-приложении</span>
          </div>
        </div>
        <ol className="auth-steps">
          <li>Откроется чат с нашим ботом — нажмите «Старт».</li>
          <li>Бот пришлёт 4-значный код.</li>
          <li>Введите код здесь. Пароль не нужен.</li>
        </ol>
        {error && <p className="auth-error">{error}</p>}

        <div className="onb-spacer" />
        <button className="btn btn-peach btn-arrow" disabled={busy} onClick={startTelegram}>
          {busy ? 'Открываем Telegram…' : 'Войти через Telegram'}
        </button>
        <button className="auth-link" onClick={() => setStep('guest')}>
          Войти как гость
        </button>
      </>
    );
  }

  return createPortal(
    <div className="onb auth" role="dialog" aria-modal="true">
      {top}
      {body}
    </div>,
    document.body,
  );
}
