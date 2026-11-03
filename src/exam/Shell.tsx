import { LogOut } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '@/shared/auth/auth';
import { AppFooter, BrandTitle, usePublicTenant } from '@/shared/auth/pages';
import { IconButton, ThemeToggle } from '@/shared/ui';

/** Shell is the participant layout outside the exam room: no menu, only taking exams. */
export function Shell({ children }: { children: ReactNode }) {
  const { me, logout } = useAuth();
  const { data: tenant } = usePublicTenant();
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <BrandTitle tenant={tenant} fallbackName={me?.tenant.name} />
          <div className="flex items-center gap-2">
            <div className="mr-1 hidden text-right sm:block">
              <p className="max-w-[180px] truncate text-xs font-medium leading-4 text-slate-900 dark:text-white">{me?.full_name}</p>
              <p className="text-[11px] leading-4 text-slate-500 dark:text-slate-400">{me?.username}</p>
            </div>
            <ThemeToggle />
            <IconButton label="Keluar" onClick={() => void logout()}>
              <LogOut className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <AppFooter className="pb-6" />
    </div>
  );
}
