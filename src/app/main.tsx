import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { configureApi } from '@/shared/api/client';
import { UNAUTHORIZED_EVENT } from '@/shared/auth/auth';
import { initTheme, ToastProvider } from '@/shared/ui';
import '@/shared/styles.css';
import { App } from './App';

configureApi({
  tokenKey: 'doexam.app.token',
  onUnauthorized: () => window.dispatchEvent(new Event(UNAUTHORIZED_EVENT)),
});
initTheme();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 10_000 } },
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
