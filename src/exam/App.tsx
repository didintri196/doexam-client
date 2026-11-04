import { Clock, Save, WifiOff } from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import type { Me } from '@/shared/api/types';
import { AuthProvider, RequireAuth } from '@/shared/auth/auth';
import { ChangePasswordPage, LoginPage } from '@/shared/auth/pages';
import { isParticipant } from '@/shared/lib/perm';
import { SessionsPage } from './pages/SessionsPage';
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
                heading="Masuk ke ujian"
                subheading="Gunakan username dan password yang tertera di kartu peserta."
                highlights={[
                  { icon: <Save />, title: 'Jawaban tersimpan otomatis', text: 'Setiap jawaban langsung disimpan, tidak perlu menekan tombol simpan.' },
                  { icon: <WifiOff />, title: 'Tetap lanjut saat koneksi putus', text: 'Jawaban disimpan di perangkat dan dikirim ulang begitu jaringan kembali.' },
                  { icon: <Clock />, title: 'Waktu mengikuti server', text: 'Sisa waktu tidak berubah walau jam perangkat salah atau halaman dimuat ulang.' },
                ]}
              />
            }
          />
          <Route path="/change-password" element={<RequireAuth><ChangePasswordPage /></RequireAuth>} />
          <Route path="/" element={<RequireAuth><SessionsPage /></RequireAuth>} />
          <Route path="/attempt/:id" element={<RequireAuth><TakePage /></RequireAuth>} />
          <Route path="/result/:id" element={<RequireAuth><ResultPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
