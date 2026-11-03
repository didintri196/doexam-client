import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { configureApi } from '@/shared/api/client';
import { UNAUTHORIZED_EVENT } from '@/shared/auth/auth';
import { initTheme, ToastProvider } from '@/shared/ui';
import '@/shared/styles.css';
import { App } from './App';
import { deviceId } from './device';

configureApi({
  tokenKey: 'doexam.exam.token',
  onUnauthorized: () => window.dispatchEvent(new Event(UNAUTHORIZED_EVENT)),
  headers: () => ({ 'X-Device-ID': deviceId() }),
});
initTheme();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);

// Offline support: the service worker caches the exam client (scope /exam/ only).
// A new version waits until every exam tab is closed, so it never swaps mid-exam.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/exam/sw.js', { scope: '/exam/' }).catch(() => {});
    // hand over what this page already loaded, and warm the formula renderer, so both
    // are available offline before the exam starts
    void navigator.serviceWorker.ready.then((reg) => {
      const urls = performance.getEntriesByType('resource').map((e) => e.name);
      reg.active?.postMessage({ type: 'cache', urls });
      const warm = () => void import('katex').then(() => {
        const more = performance.getEntriesByType('resource').map((e) => e.name);
        reg.active?.postMessage({ type: 'cache', urls: more });
      });
      if ('requestIdleCallback' in window) requestIdleCallback(warm);
      else setTimeout(warm, 2000);
    });
  });
}
