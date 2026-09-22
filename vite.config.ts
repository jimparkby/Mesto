import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — одинаково работает на GitHub Pages (подпапка), в Telegram и внутри Capacitor WebView.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: true, port: 5173 },
});
