import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '@/shared/auth/auth';
import { Brand, usePublicTenant } from '@/shared/auth/pages';
import { IconButton, ThemeToggle } from '@/shared/ui';

/** Shell is the participant layout outside the exam room: no menu, only taking exams. */
export function Shell({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const { data: tenant } = usePublicTenant();
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex h-15 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <Brand tenant={tenant} />
            <div className="min-w-0">
              <p className="text-base font-bold leading-none tracking-tight text-slate-900 dark:text-white">DoExam</p>
              <p className="truncate text-[11px] text-slate-500">{tenant?.name ?? me?.tenant.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden text-right sm:block">
              <p className="max-w-[160px] truncate text-xs font-semibold text-slate-800 dark:text-slate-100">{me?.full_name}</p>
              <p className="font-mono text-[10px] text-slate-500">{me?.username}</p>
            </div>
            <ThemeToggle />
            <IconButton label="Keluar" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
