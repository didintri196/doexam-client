import { ChartColumn, Library, MonitorCheck } from 'lucide-react';
import { useCallback } from 'react';
import { MediaProvider } from './components/MediaProvider';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router';
import type { Me } from '@/shared/api/types';
import { AuthProvider, RequireAuth } from '@/shared/auth/auth';
import { ChangePasswordPage, LoginPage } from '@/shared/auth/pages';
import { isStaff } from '@/shared/lib/perm';
import { Layout } from './Layout';
import { BankDetailPage, BanksPage } from './pages/BanksPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExamDetailPage } from './pages/ExamDetailPage';
import { ExamsPage } from './pages/ExamsPage';
import { GradingIndexPage, GradingPage } from './pages/GradingPage';
import { GroupsPage } from './pages/GroupsPage';
import { ImportsPage } from './pages/ImportsPage';
import { ItemEditorPage } from './pages/ItemEditorPage';
import { MonitorPage } from './pages/MonitorPage';
import { AttemptReportPage, ReportPage, ReportsIndexPage } from './pages/ReportsPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { SessionsPage } from './pages/SessionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SetupPage } from './pages/SetupPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { SessionPrintPage } from './pages/SessionPrintPage';
import { WordImportPage } from './pages/WordImportPage';
import { TokenBoardPage } from './pages/TokenBoardPage';
import { UsersPage } from './pages/UsersPage';

// Staff sign in here with their own session; participants use /exam/ (DOCS/PLAN/09-FRONTEND.md §4).
const accept = (me: Me) => (isStaff(me.permissions) ? null : 'Akun ini akun peserta. Masuk lewat halaman ujian di /exam/.');

function Login() {
  const navigate = useNavigate();
  const toSetup = useCallback(() => navigate('/setup', { replace: true }), [navigate]);
  return (
    <LoginPage
      heading="Masuk ke panel staf"
      subheading="Untuk penyusun soal, pengawas, penilai, dan admin."
      highlights={[
        { icon: <Library />, title: 'Bank soal & penyusunan', text: 'Tulis, impor, dan susun soal menjadi ujian.' },
        { icon: <MonitorCheck />, title: 'Pengawasan langsung', text: 'Pantau peserta, buka kunci, dan tambah waktu saat sesi berjalan.' },
        { icon: <ChartColumn />, title: 'Penilaian & analisis', text: 'Koreksi esai, rekap nilai, dan analisis butir soal.' },
      ]}
      onSetupRequired={toSetup}
      footer={
        <>
          Peserta ujian? Masuk lewat{' '}
          <a href="/exam/" className="font-medium text-blue-700 hover:underline dark:text-blue-300">
            halaman ujian
          </a>
          .
        </>
      }
    />
  );
}

export function App() {
  return (
    <BrowserRouter basename="/app">
      <AuthProvider accept={accept}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/change-password" element={<RequireAuth><ChangePasswordPage /></RequireAuth>} />
          <Route path="/sessions/:id/board" element={<RequireAuth><TokenBoardPage /></RequireAuth>} />
          <Route path="/sessions/:id/print/:doc" element={<RequireAuth><SessionPrintPage /></RequireAuth>} />
          <Route element={<RequireAuth><MediaProvider><Layout /></MediaProvider></RequireAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="sessions/:id" element={<SessionDetailPage />} />
            <Route path="sessions/:id/monitor" element={<MonitorPage />} />
            <Route path="banks" element={<BanksPage />} />
            <Route path="banks/:id" element={<BankDetailPage />} />
            <Route path="banks/:bankId/items/new" element={<ItemEditorPage />} />
            <Route path="banks/:id/import-word" element={<WordImportPage />} />
            <Route path="items/:id" element={<ItemEditorPage />} />
            <Route path="subjects" element={<SubjectsPage />} />
            <Route path="exams" element={<ExamsPage />} />
            <Route path="exams/:id" element={<ExamDetailPage />} />
            <Route path="grading" element={<GradingIndexPage />} />
            <Route path="grading/:examId" element={<GradingPage />} />
            <Route path="reports" element={<ReportsIndexPage />} />
            <Route path="reports/attempts/:id" element={<AttemptReportPage />} />
            <Route path="reports/:examId" element={<ReportPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="groups" element={<GroupsPage />} />
            <Route path="imports" element={<ImportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
