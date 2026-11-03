import { GraduationCap } from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import type { Me } from '@/shared/api/types';
import { AuthProvider, RequireAuth } from '@/shared/auth/auth';
import { ChangePasswordPage, LoginPage } from '@/shared/auth/pages';
import { isParticipant } from '@/shared/lib/perm';
import { Badge } from '@/shared/ui';
import { HistoryPage, SessionsPage } from './pages/SessionsPage';
import { ResultPage } from './pages/ResultPage';
import { TakePage } from './pages/TakePage';

// Only participants sign in here; staff use the panel (/app/), with their own session.
const accept = (me: Me) => (isParticipant(me.permissions) ? null : 'Akun ini bukan akun peserta ujian. Gunakan panel staf di /app/.');

export function App() {
  return (
    <BrowserRouter basename="/exam">
      <AuthProvider accept={accept}>
        <Routes>
          <Route
            path="/login"
            element={
              <LoginPage
                heading="Portal peserta ujian"
                badge={
                  <Badge tone="blue">
                    <GraduationCap className="h-3.5 w-3.5" /> Peserta
                  </Badge>
                }
                footer={
                  <>
                    Staf atau pengawas? Masuk lewat{' '}
                    <a href="/app/" className="font-semibold text-blue-600 hover:underline">
                      panel staf
                    </a>
                    .
                  </>
                }
              />
            }
          />
          <Route path="/change-password" element={<RequireAuth><ChangePasswordPage /></RequireAuth>} />
          <Route path="/" element={<RequireAuth><SessionsPage /></RequireAuth>} />
          <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
          <Route path="/attempt/:id" element={<RequireAuth><TakePage /></RequireAuth>} />
          <Route path="/result/:id" element={<RequireAuth><ResultPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
