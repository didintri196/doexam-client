import { useQuery } from '@tanstack/react-query';
import { ArrowRight, KeyRound, Lock, School, User } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { authApi } from '@/shared/api/auth';
import { ApiError } from '@/shared/api/client';
import type { PublicTenant } from '@/shared/api/types';
import { applyBrand } from '@/shared/lib/brand';
import { errorMessage, fieldErrors } from '@/shared/lib/errors';
import { Alert, Button, Field, Input, ThemeToggle } from '@/shared/ui';
import { useAuth } from './auth';

/**
 * usePublicTenant reads the institution shown before login. The server answers
 * 404 "setup not completed" on a fresh install and 400 {tenant: required} when one
 * installation serves several institutions.
 */
export function usePublicTenant(slug?: string) {
  const q = useQuery<PublicTenant, ApiError>({
    queryKey: ['public-tenant', slug ?? ''],
    queryFn: () => authApi.publicTenant(slug),
    retry: (n, err) => err.isNetwork && n < 2,
    staleTime: 5 * 60_000,
  });
  const color = q.data?.primary_color;
  useEffect(() => applyBrand(color), [color]);
  return q;
}

export function Brand({ tenant, size = 'md' }: { tenant?: PublicTenant | null; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-12 w-12 rounded-xl' : 'h-8 w-8 rounded-lg';
  if (tenant?.logo_url) {
    return <img src={tenant.logo_url} alt="" className={`${box} shrink-0 border border-slate-200 bg-white object-contain p-0.5 dark:border-slate-700`} />;
  }
  return <img src="/favicon.svg" alt="" className={`${box} shrink-0`} />;
}

/** BrandTitle is the header block: tenant logo, name and tagline. */
export function BrandTitle({ tenant, fallbackName }: { tenant?: PublicTenant | null; fallbackName?: string }) {
  const name = tenant?.name ?? fallbackName ?? 'DoExam';
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Brand tenant={tenant} />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-5 text-slate-900 dark:text-white">{name}</p>
        {tenant?.tagline && <p className="truncate text-[11px] leading-4 text-slate-500 dark:text-slate-400">{tenant.tagline}</p>}
      </div>
    </div>
  );
}

const REPO_URL = 'https://github.com/didintri196/doexam-server';
// a release ("1.2.0") reads as v1.2.0; an untagged build shows its commit as is
const VERSION = /^\d/.test(__APP_VERSION__) ? `v${__APP_VERSION__}` : __APP_VERSION__;

/** AppFooter credits the open source project and shows the client version. */
export function AppFooter({ className }: { className?: string }) {
  return (
    <p className={`no-print text-center text-[11px] tabular-nums text-slate-500 ${className ?? ''}`}>
      ©{' '}
      <a href={REPO_URL} target="_blank" rel="noreferrer" className="font-medium text-slate-600 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-white">
        DoExam
      </a>{' '}
      · {VERSION}
    </p>
  );
}

export function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50 px-4 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-16">
        {children}
        {footer && <div className="mt-6 text-center text-xs text-slate-500 dark:text-slate-400">{footer}</div>}
      </div>
      <AppFooter className="pb-6" />
    </div>
  );
}

export function LoginPage({
  heading,
  badge,
  footer,
  onSetupRequired,
}: {
  heading: string;
  badge: ReactNode;
  footer?: ReactNode;
  onSetupRequired?: () => void;
}) {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [slug, setSlug] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const pub = usePublicTenant(slug.trim() || undefined);
  const setupRequired = pub.error?.status === 404 && pub.error.message === 'setup not completed';
  const needTenant = pub.error?.status === 400 || !!fields.tenant || slug !== '';
  const tenant = pub.data;

  useEffect(() => {
    if (setupRequired) onSetupRequired?.();
  }, [setupRequired, onSetupRequired]);

  if (status === 'ready') {
    const from = (loc.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await login(username.trim(), password, slug.trim() || undefined);
      navigate('/', { replace: true });
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell footer={footer}>
      <div className="flex flex-col items-center text-center">
        <Brand tenant={tenant} size="lg" />
        <h1 className="mt-5 text-balance text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{tenant?.name ?? 'DoExam'}</h1>
        {tenant?.tagline && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{tenant.tagline}</p>}
        <div className="mt-4 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          {badge}
          <span>{heading}</span>
        </div>
      </div>

      <div className="mt-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {setupRequired ? (
            <Alert tone="amber">Aplikasi belum di-setup. Minta admin menyelesaikan setup di panel staf.</Alert>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {needTenant && (
                <Field label="Kode institusi" error={fields.tenant} hint="Instalasi ini melayani beberapa institusi.">
                  <div className="relative">
                    <School className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input className="h-9 pl-9 font-mono" value={slug} onChange={(e) => setSlug(e.target.value)} autoComplete="organization" />
                  </div>
                </Field>
              )}
              <Field label="Username" error={fields.username}>
                <div className="relative">
                  <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="h-9 pl-9"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    autoFocus
                    required
                  />
                </div>
              </Field>
              <Field label="Password" error={fields.password}>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="h-9 pl-9"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </Field>
              {error && <Alert>{error}</Alert>}
              <Button type="submit" size="lg" className="mt-2 w-full" loading={busy}>
                Masuk {!busy && <ArrowRight className="h-4 w-4" />}
              </Button>
            </form>
          )}
        </div>
      </div>
    </AuthShell>
  );
}

export function ChangePasswordPage() {
  const { me, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setFields({ confirm: 'tidak sama dengan password baru' });
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await authApi.changePassword(current, next);
      await refresh();
      navigate('/', { replace: true });
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div>
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <KeyRound className="h-5 w-5" />
          </span>
          <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900 dark:text-white">Ganti password</h1>
          {me?.must_change_password && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">Demi keamanan, ganti password sementara Anda sebelum melanjutkan.</p>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={submit} className="space-y-4">
            <Field label="Password saat ini" error={fields.current_password}>
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
            </Field>
            <Field label="Password baru" error={fields.new_password} hint="Minimal 8 karakter.">
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} required />
            </Field>
            <Field label="Ulangi password baru" error={fields.confirm}>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
            </Field>
            {error && <Alert>{error}</Alert>}
            <div className="flex gap-2">
              {!me?.must_change_password && (
                <Button variant="secondary" className="flex-1" onClick={() => navigate(-1)}>
                  Batal
                </Button>
              )}
              <Button type="submit" className="flex-1" loading={busy}>
                Simpan password
              </Button>
            </div>
            {me?.must_change_password && (
              <button type="button" className="w-full text-center text-xs text-slate-500 hover:underline" onClick={() => void logout()}>
                Keluar
              </button>
            )}
          </form>
        </div>
      </div>
    </AuthShell>
  );
}
