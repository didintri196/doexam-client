import {
  BarChart3,
  BookOpenCheck,
  CalendarClock,
  CheckSquare,
  ChevronsUpDown,
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
      { to: '/subjects', label: 'Subjek & kompetensi', icon: <BookOpenCheck className={i} />, perms: [Perm.ItemWrite, Perm.TenantManage] },
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
      { to: '/groups', label: 'Grup', icon: <UsersRound className={i} />, perms: [Perm.GroupManage] },
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white md:flex dark:border-slate-800 dark:bg-slate-900">
        <Sidebar groups={groups} />
      </aside>

      <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-slate-200 bg-white px-4 md:hidden dark:border-slate-800 dark:bg-slate-900">
        <IconButton label="Buka menu" onClick={() => setMobile(true)}>
          <Menu className="h-4 w-4" />
        </IconButton>
        <TenantLink />
      </header>

      <div className="flex min-h-screen flex-col md:pl-60">
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-7xl">
            <Outlet />
          </div>
        </main>
        <AppFooter className="pb-6" />
      </div>

      {mobile && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 md:hidden" onClick={() => setMobile(false)}>
          <aside className="flex h-full w-72 flex-col bg-white shadow-2xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <Sidebar groups={groups} onNavigate={() => setMobile(false)} onClose={() => setMobile(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}

function TenantLink() {
  const { me } = useAuth();
  const { data: tenant } = usePublicTenant();
  return (
    <NavLink to="/" className="min-w-0 rounded-lg">
      <BrandTitle tenant={tenant} fallbackName={me?.tenant.name} />
    </NavLink>
  );
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'flex h-8 items-center gap-2.5 rounded-lg px-2.5 text-xs font-medium transition-colors [&_svg]:h-4 [&_svg]:w-4',
    isActive
      ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white [&_svg]:text-blue-600 dark:[&_svg]:text-blue-400'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white [&_svg]:text-slate-400',
  );

function Sidebar({ groups, onNavigate, onClose }: { groups: NavGroup[]; onNavigate?: () => void; onClose?: () => void }) {
  return (
    <>
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
        <TenantLink />
        {onClose && (
          <IconButton label="Tutup menu" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        )}
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="mb-1 px-2.5 text-[11px] font-medium text-slate-400 dark:text-slate-500">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.to === '/'} className={linkClass} onClick={onNavigate}>
                  {it.icon}
                  <span className="truncate">{it.label}</span>
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <UserMenu />
    </>
  );
}

function UserMenu() {
  const { me, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0 border-t border-slate-200 p-3 dark:border-slate-800">
      {open && (
        <div
          className="absolute inset-x-3 bottom-full z-50 mb-1 rounded-xl border border-slate-200 bg-white p-1 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-800"
          onMouseLeave={() => setOpen(false)}
        >
          <p className="truncate px-2.5 py-1.5 font-mono text-[11px] text-slate-500 dark:text-slate-400">{me?.username}</p>
          <button
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            onClick={() => {
              setOpen(false);
              navigate('/change-password');
            }}
          >
            <KeyRound className="h-4 w-4 text-slate-400" /> Ganti password
          </button>
          <button
            type="button"
            className="flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
            onClick={() => void logout()}
          >
            <LogOut className="h-4 w-4" /> Keluar
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-accent-fg">
            {me?.full_name.charAt(0).toUpperCase() ?? '?'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium leading-4 text-slate-900 dark:text-white">{me?.full_name}</span>
            <span className="block truncate text-[11px] leading-4 text-slate-500 dark:text-slate-400">{me?.roles.join(', ')}</span>
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
        </button>
        <ThemeToggle />
      </div>
    </div>
  );
}
