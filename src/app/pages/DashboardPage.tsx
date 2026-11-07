import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowRight, BarChart3, CalendarClock, CheckSquare, FileQuestion, Layers, MonitorPlay, Users } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '@/shared/auth/auth';
import { formatTime, labels } from '@/shared/lib/format';
import { Badge, Card, EmptyState, Loading, PageHeader, Pagination } from '@/shared/ui';
import { sessionApi } from '../api';
import { Perm, useCan } from '../perm';
import { sessionTone } from './SessionsPage';

const TODAY_PER_PAGE = 10;

export function DashboardPage() {
  const { me } = useAuth();
  const can = useCan();
  const canSessions = can(Perm.SessionManage, Perm.SessionProctor);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const [page, setPage] = useState(1);
  const today = useQuery({
    queryKey: ['sessions', 'today', start.toISOString(), page],
    queryFn: () => sessionApi.list({ from: start.toISOString(), to: end.toISOString(), page, per_page: TODAY_PER_PAGE }),
    enabled: canSessions,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData, // the list stays while the next page loads
  });
  // a session cancelled or moved off today can empty the last page: step back
  useEffect(() => {
    if (today.data && today.data.items.length === 0 && page > 1) setPage(page - 1);
  }, [today.data, page]);

  const links: { to: string; label: string; desc: string; icon: ReactNode; ok: boolean }[] = [
    { to: '/sessions', label: 'Sesi ujian', desc: 'Jadwal, token ruang, peserta, monitor', icon: <CalendarClock className="h-5 w-5" />, ok: canSessions },
    { to: '/banks', label: 'Bank soal', desc: 'Tulis dan kelola soal', icon: <FileQuestion className="h-5 w-5" />, ok: can(Perm.ItemRead, Perm.ItemWrite) },
    { to: '/exams', label: 'Ujian', desc: 'Susun bagian, soal, dan terbitkan', icon: <Layers className="h-5 w-5" />, ok: can(Perm.ExamRead, Perm.ExamWrite) },
    { to: '/grading', label: 'Koreksi', desc: 'Nilai esai & regrade', icon: <CheckSquare className="h-5 w-5" />, ok: can(Perm.GradeWrite, Perm.ExamWrite, Perm.TenantManage) },
    { to: '/reports', label: 'Laporan', desc: 'Rekap nilai & analisis butir', icon: <BarChart3 className="h-5 w-5" />, ok: can(Perm.ReportRead, Perm.TenantManage) },
    { to: '/users/participants', label: 'Peserta', desc: 'Akun peserta, reset password', icon: <Users className="h-5 w-5" />, ok: can(Perm.UserManage) },
  ];

  const shortcuts = links.filter((l) => l.ok);
  return (
    <>
      <PageHeader title={`Selamat datang, ${me?.full_name ?? ''}`} subtitle={me?.tenant.name} />
      <div className="grid items-start gap-6 lg:grid-cols-3">
        {canSessions && (
          <Card
            title="Sesi ujian hari ini"
            className="lg:col-span-2"
            actions={
              <Link to="/sessions" className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">
                Semua sesi
              </Link>
            }
          >
            {today.isLoading ? (
              <Loading />
            ) : !today.data?.items.length ? (
              <EmptyState icon={<CalendarClock />} title="Tidak ada sesi hari ini">
                Sesi yang dijadwalkan hari ini muncul di sini beserta tombol monitornya.
              </EmptyState>
            ) : (
              <ul className="-my-2 divide-y divide-slate-100 dark:divide-slate-800">
                {today.data.items.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{s.exam_title}</p>
                        <Badge tone={sessionTone[s.status]}>{labels.sessionStatus[s.status]}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {s.name} · {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
                        {s.room && ` · ${s.room}`} · {s.participant_count} peserta
                      </p>
                    </div>
                    <Link
                      to={`/sessions/${s.id}/monitor`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
                    >
                      <MonitorPlay className="h-4 w-4 text-slate-400" /> Monitor
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {today.data && <Pagination page={page} perPage={TODAY_PER_PAGE} total={today.data.total} onPage={setPage} />}
          </Card>
        )}
        {shortcuts.length > 0 && (
          <section className={canSessions ? '' : 'lg:col-span-3'}>
            <h2 className="mb-2 px-1 text-xs font-medium text-slate-500 dark:text-slate-400">Pintasan</h2>
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {shortcuts.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <span className="text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 [&_svg]:h-4 [&_svg]:w-4">{l.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium text-slate-900 dark:text-white">{l.label}</span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{l.desc}</span>
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-500 dark:text-slate-600" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
