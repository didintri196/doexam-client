import { useQuery } from '@tanstack/react-query';
import { ArrowRight, BarChart3, CalendarClock, CheckSquare, FileQuestion, Layers, MonitorPlay, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/shared/auth/auth';
import { formatTime, labels } from '@/shared/lib/format';
import { Badge, Card, EmptyState, Loading, PageHeader } from '@/shared/ui';
import { sessionApi } from '../api';
import { Perm, useCan } from '../perm';
import { sessionTone } from './SessionsPage';

export function DashboardPage() {
  const { me } = useAuth();
  const can = useCan();
  const canSessions = can(Perm.SessionManage, Perm.SessionProctor);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const today = useQuery({
    queryKey: ['sessions', 'today', start.toISOString()],
    queryFn: () => sessionApi.list({ from: start.toISOString(), to: end.toISOString(), per_page: 50 }),
    enabled: canSessions,
    refetchInterval: 30_000,
  });

  const links: { to: string; label: string; desc: string; icon: ReactNode; ok: boolean }[] = [
    { to: '/sessions', label: 'Sesi ujian', desc: 'Jadwal, token ruang, peserta, monitor', icon: <CalendarClock className="h-5 w-5" />, ok: canSessions },
    { to: '/banks', label: 'Bank soal', desc: 'Tulis dan kelola soal', icon: <FileQuestion className="h-5 w-5" />, ok: can(Perm.ItemRead, Perm.ItemWrite) },
    { to: '/exams', label: 'Ujian', desc: 'Susun bagian, soal, dan terbitkan', icon: <Layers className="h-5 w-5" />, ok: can(Perm.ExamRead, Perm.ExamWrite) },
    { to: '/grading', label: 'Koreksi', desc: 'Nilai esai & regrade', icon: <CheckSquare className="h-5 w-5" />, ok: can(Perm.GradeWrite, Perm.ExamWrite, Perm.TenantManage) },
    { to: '/reports', label: 'Laporan', desc: 'Rekap nilai & analisis butir', icon: <BarChart3 className="h-5 w-5" />, ok: can(Perm.ReportRead, Perm.TenantManage) },
    { to: '/users', label: 'Pengguna', desc: 'Akun, peran, reset password', icon: <Users className="h-5 w-5" />, ok: can(Perm.UserManage) },
  ];

  return (
    <>
      <PageHeader title={`Selamat datang, ${me?.full_name ?? ''}`} subtitle={me?.tenant.name} />
      {canSessions && (
        <Card title="Sesi ujian hari ini" className="mb-6" actions={<Link to="/sessions" className="text-xs font-semibold text-blue-600 hover:underline">Semua sesi</Link>}>
          {today.isLoading ? (
            <Loading />
          ) : !today.data?.items.length ? (
            <EmptyState icon={<CalendarClock className="h-8 w-8" />} title="Tidak ada sesi hari ini" />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {today.data.items.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{s.exam_title}</p>
                    <p className="text-[11px] text-slate-500">
                      {s.name} · {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
                      {s.room && ` · ${s.room}`} · {s.participant_count} peserta
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={sessionTone[s.status]}>{labels.sessionStatus[s.status]}</Badge>
                    <Link to={`/sessions/${s.id}/monitor`} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                      <MonitorPlay className="h-3.5 w-3.5" /> Monitor
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {links
          .filter((l) => l.ok)
          .map((l) => (
            <Link key={l.to} to={l.to} className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900">
              <span className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/50 dark:text-blue-300">{l.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-slate-900 dark:text-white">{l.label}</span>
                <span className="block text-xs text-slate-500">{l.desc}</span>
              </span>
              <ArrowRight className="mt-1 h-4 w-4 text-slate-300 transition-colors group-hover:text-blue-600" />
            </Link>
          ))}
      </div>
    </>
  );
}
