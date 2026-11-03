import {
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CheckSquare,
  ChevronDown,
  FileQuestion,
  FileSpreadsheet,
  KeyRound,
  Layers,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  UsersRound,
  X,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '@/shared/auth/auth';
import { AppFooter, BrandTitle, usePublicTenant } from '@/shared/auth/pages';
import { cx, IconButton, ThemeToggle } from '@/shared/ui';
import { Perm, useCan } from './perm';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  perms: string[]; // any of
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const i = 'h-4 w-4';
const NAV: NavGroup[] = [
  { label: 'Utama', items: [{ to: '/', label: 'Ringkasan', icon: <LayoutDashboard className={i} />, perms: [] }] },
  {
    label: 'Pelaksanaan',
    items: [{ to: '/sessions', label: 'Sesi & pengawasan', icon: <CalendarClock className={i} />, perms: [Perm.SessionManage, Perm.SessionProctor] }],
  },
  {
    label: 'Penyusunan',
    items: [
      { to: '/banks', label: 'Bank soal', icon: <FileQuestion className={i} />, perms: [Perm.ItemRead, Perm.ItemWrite] },
      { to: '/exams', label: 'Ujian', icon: <Layers className={i} />, perms: [Perm.ExamRead, Perm.ExamWrite] },
      { to: '/subjects', label: 'Mapel & kompetensi', icon: <BookOpenCheck className={i} />, perms: [Perm.ItemWrite, Perm.TenantManage] },
    ],
  },
  {
    label: 'Pasca ujian',
    items: [
      { to: '/grading', label: 'Koreksi & regrade', icon: <CheckSquare className={i} />, perms: [Perm.GradeWrite, Perm.ExamWrite, Perm.TenantManage] },
      { to: '/reports', label: 'Laporan & analisis', icon: <BarChart3 className={i} />, perms: [Perm.ReportRead, Perm.TenantManage] },
    ],
  },
  {
    label: 'Administrasi',
    items: [
      { to: '/users', label: 'Pengguna', icon: <Users className={i} />, perms: [Perm.UserManage] },
      { to: '/groups', label: 'Kelas & grup', icon: <UsersRound className={i} />, perms: [Perm.GroupManage] },
      { to: '/imports', label: 'Impor Excel', icon: <FileSpreadsheet className={i} />, perms: [Perm.UserManage, Perm.GroupManage] },
      { to: '/settings', label: 'Pengaturan institusi', icon: <Settings className={i} />, perms: [Perm.TenantManage] },
    ],
  },
];

export function Layout() {
  const can = useCan();
  const groups = NAV.map((g) => ({ ...g, items: g.items.filter((it) => it.perms.length === 0 || can(...it.perms)) })).filter((g) => g.items.length);
  const [mobile, setMobile] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <Header onMenu={() => setMobile(true)} />
      <div className="flex flex-1">
        <aside className="no-print hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 md:block dark:border-slate-800 dark:bg-slate-900">
          <SideNav groups={groups} />
        </aside>
        <main className="flex min-w-0 flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-7xl flex-1">
            <Outlet />
          </div>
          <AppFooter className="mt-8" />
        </main>
      </div>
      {mobile && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 md:hidden" onClick={() => setMobile(false)}>
          <aside className="h-full w-72 overflow-y-auto bg-white p-4 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex justify-end">
              <IconButton label="Tutup menu" onClick={() => setMobile(false)}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            <SideNav groups={groups} onNavigate={() => setMobile(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
    isActive
      ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
  );

function SideNav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">{g.label}</p>
          <nav className="space-y-1">
            {g.items.map((it) => (
              <NavLink key={it.to} to={it.to} end={it.to === '/'} className={linkClass} onClick={onNavigate}>
                {it.icon}
                <span>{it.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      ))}
    </div>
  );
}

function Header({ onMenu }: { onMenu: () => void }) {
  const { me, logout } = useAuth();
  const { data: tenant } = usePublicTenant();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex h-15 items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <IconButton label="Menu" className="md:hidden" onClick={onMenu}>
            <Menu className="h-4 w-4" />
          </IconButton>
          <button type="button" onClick={() => navigate('/')} className="min-w-0 text-left">
            <BrandTitle tenant={tenant} fallbackName={me?.tenant.name} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white py-1.5 pl-2 pr-2.5 text-xs font-medium text-slate-800 shadow-xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">{me?.full_name.charAt(0) ?? '?'}</span>
              <span className="hidden text-left sm:block">
                <span className="block max-w-[140px] truncate font-semibold leading-none">{me?.full_name}</span>
                <span className="text-[10px] leading-tight text-slate-500">{me?.roles.join(', ')}</span>
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {open && (
              <div
                className="absolute right-0 z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800"
                onMouseLeave={() => setOpen(false)}
              >
                <p className="px-2.5 py-1.5 font-mono text-[11px] text-slate-500">{me?.username}</p>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 hover:bg-slate-50 dark:hover:bg-slate-700"
                  onClick={() => {
                    setOpen(false);
                    navigate('/change-password');
                  }}
                >
                  <KeyRound className="h-4 w-4" /> Ganti password
                </button>
                <button type="button" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40" onClick={() => void logout()}>
                  <LogOut className="h-4 w-4" /> Keluar
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
