import { useQuery } from '@tanstack/react-query';
import { ArrowRight, KeyRound, Lock, School, User } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { authApi } from '@/shared/api/auth';
import { ApiError } from '@/shared/api/client';
import type { PublicTenant } from '@/shared/api/types';
import { errorMessage, fieldErrors } from '@/shared/lib/errors';
import { Alert, Button, Field, Input, ThemeToggle } from '@/shared/ui';
import { useAuth } from './auth';

/**
 * usePublicTenant reads the institution shown before login. The server answers
 * 404 "setup not completed" on a fresh install and 400 {tenant: required} when one
 * installation serves several institutions.
 */
export function usePublicTenant(slug?: string) {
  return useQuery<PublicTenant, ApiError>({
    queryKey: ['public-tenant', slug ?? ''],
    queryFn: () => authApi.publicTenant(slug),
    retry: (n, err) => err.isNetwork && n < 2,
    staleTime: 5 * 60_000,
  });
}

export function Brand({ tenant, size = 'md' }: { tenant?: PublicTenant | null; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 'h-16 w-16 rounded-2xl' : 'h-8 w-8 rounded-lg';
  if (tenant?.logo_url) {
    return <img src={tenant.logo_url} alt="" className={`${box} border border-slate-200 bg-white object-contain shadow-sm dark:border-slate-700`} />;
  }
  return <img src="/favicon.svg" alt="" className={`${box} shadow-sm`} />;
}

export function AuthShell({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      {children}
      {footer && <div className="mt-6 text-center text-xs text-slate-500">{footer}</div>}
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
      <div className="space-y-3 text-center sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <Brand tenant={tenant} size="lg" />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{tenant?.name ?? 'DoExam'}</h1>
        <p className="text-xs text-slate-500">{heading}</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="space-y-5 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-xl sm:px-10 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex justify-center">{badge}</div>
          {setupRequired ? (
            <Alert tone="amber">Aplikasi belum di-setup. Minta admin menyelesaikan setup di panel staf.</Alert>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {needTenant && (
                <Field label="Kode institusi" error={fields.tenant} hint="Instalasi ini melayani beberapa institusi.">
                  <div className="relative">
                    <School className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input className="pl-9 font-mono" value={slug} onChange={(e) => setSlug(e.target.value)} autoComplete="organization" />
                  </div>
                </Field>
              )}
              <Field label="Username" error={fields.username}>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9 font-mono"
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
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>
              </Field>
              {error && <Alert>{error}</Alert>}
              <Button type="submit" size="lg" className="w-full" loading={busy} icon={!busy && <ArrowRight className="h-4 w-4" />}>
                Masuk
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
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="space-y-5 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-xl sm:px-10 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-1 text-center">
            <KeyRound className="mx-auto h-8 w-8 text-blue-600" />
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">Ganti password</h1>
            {me?.must_change_password && <p className="text-xs text-slate-500">Demi keamanan, ganti password sementara Anda sebelum melanjutkan.</p>}
          </div>
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
