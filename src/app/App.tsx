import { Briefcase } from 'lucide-react';
import { useCallback } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router';
import type { Me } from '@/shared/api/types';
import { AuthProvider, RequireAuth } from '@/shared/auth/auth';
import { ChangePasswordPage, LoginPage } from '@/shared/auth/pages';
import { isStaff } from '@/shared/lib/perm';
import { Badge } from '@/shared/ui';
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
import { TokenBoardPage } from './pages/TokenBoardPage';
import { UsersPage } from './pages/UsersPage';

// Staff sign in here with their own session; participants use /exam/ (DOCS/PLAN/09-FRONTEND.md §4).
const accept = (me: Me) => (isStaff(me.permissions) ? null : 'Akun ini akun peserta. Masuk lewat halaman ujian di /exam/.');

function Login() {
  const navigate = useNavigate();
  const toSetup = useCallback(() => navigate('/setup', { replace: true }), [navigate]);
  return (
    <LoginPage
      heading="Panel staf: guru, pengawas, dan admin"
      badge={
        <Badge tone="blue">
          <Briefcase className="h-3.5 w-3.5" /> Staf
        </Badge>
      }
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
          <Route element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<DashboardPage />} />
            <Route path="sessions" element={<SessionsPage />} />
            <Route path="sessions/:id" element={<SessionDetailPage />} />
            <Route path="sessions/:id/monitor" element={<MonitorPage />} />
            <Route path="banks" element={<BanksPage />} />
            <Route path="banks/:id" element={<BankDetailPage />} />
            <Route path="banks/:bankId/items/new" element={<ItemEditorPage />} />
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
