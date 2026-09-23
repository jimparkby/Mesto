import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { platform } from './platforms';
import '@fontsource-variable/inter';
import './styles.css';

// Если приложение упало до первой отрисовки, показываем текст ошибки вместо белого экрана.
function showFatal(message: string) {
  const root = document.getElementById('root');
  if (!root || root.childElementCount > 0) return;
  root.innerHTML = '';
  const pre = document.createElement('pre');
  pre.style.cssText = 'padding:16px;white-space:pre-wrap;font:13px/1.4 monospace;color:#9e212e';
  pre.textContent = `Не удалось запустить приложение:\n${message}`;
  root.appendChild(pre);
}
window.addEventListener('error', (e) => showFatal(e.error?.stack ?? e.message));
window.addEventListener('unhandledrejection', (e) => showFatal(String(e.reason?.stack ?? e.reason)));

platform
  .init()
  .catch((e) => console.error('platform init failed', e))
  .finally(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
