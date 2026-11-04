import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Eye, EyeOff, KeyRound, Lock, School, User } from 'lucide-react';
import { useEffect, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { authApi } from '@/shared/api/auth';
import { ApiError } from '@/shared/api/client';
import type { PublicTenant } from '@/shared/api/types';
import { applyBrand } from '@/shared/lib/brand';
import { errorMessage, fieldErrors } from '@/shared/lib/errors';
import { Alert, Button, cx, Field, Input, ThemeToggle } from '@/shared/ui';
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

export type LoginHighlight = { icon: ReactNode; title: string; text: string };

/**
 * LoginPage: the institution on an accent panel (left on wide screens, a header band on
 * phones) and the sign-in form beside it. `highlights` are short notes for whoever signs in.
 */
export function LoginPage({
  heading,
  subheading,
  highlights = [],
  footer,
  onSetupRequired,
}: {
  heading: string;
  subheading?: string;
  highlights?: LoginHighlight[];
  footer?: ReactNode;
  onSetupRequired?: () => void;
}) {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [slug, setSlug] = useState('');
  // ?u= prefills the username (QR code on the participant card)
  const [username, setUsername] = useState(() => new URLSearchParams(window.location.search).get('u') ?? '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const prefilled = useState(() => username !== '')[0];

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

  const name = tenant?.name ?? 'DoExam';
  const capsCheck = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState('CapsLock'));

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-50 lg:flex-row dark:bg-slate-950">
      {/* sits on the accent band on phones, in the form column's corner on wide screens */}
      <div className="absolute right-4 top-[30px] z-10 lg:top-4">
        <ThemeToggle />
      </div>
      <aside className="relative isolate overflow-hidden bg-blue-600 text-accent-fg lg:flex lg:w-[44%] lg:max-w-xl lg:flex-col">
        {/* faint dot grid in the text colour, so it works on light and dark tenant colours */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.09] [background-image:radial-gradient(currentColor_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        />
        <div aria-hidden className="absolute -bottom-40 -right-40 -z-10 h-96 w-96 rounded-full bg-blue-700 opacity-60 blur-3xl" />

        {/* hidden until the institution loads, so its name never flashes "DoExam" first */}
        <div className={cx('flex items-center gap-3 px-6 py-6 transition-opacity lg:px-12 lg:pt-12', pub.isPending && 'opacity-0')}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white p-1 shadow-sm lg:h-14 lg:w-14 lg:rounded-2xl lg:p-1.5">
            <img src={tenant?.logo_url ?? '/favicon.svg'} alt="" className="h-full w-full object-contain" />
          </span>
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-sm font-semibold leading-5">{name}</p>
            {tenant?.tagline && <p className="truncate text-[11px] leading-4 opacity-80">{tenant.tagline}</p>}
          </div>
        </div>

        <div className="hidden flex-1 flex-col justify-center px-12 pb-12 lg:flex">
          <div className={cx('transition-opacity', pub.isPending && 'opacity-0')}>
            <h1 className="text-balance text-[2rem] font-semibold leading-tight tracking-tight">{name}</h1>
            {tenant?.tagline && <p className="mt-2 text-base opacity-85">{tenant.tagline}</p>}
          </div>
          {highlights.length > 0 && (
            <ul className="mt-10 space-y-5">
              {highlights.map((h) => (
                <li key={h.title} className="flex gap-3.5">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-current/15 [&_svg]:h-4 [&_svg]:w-4">
                    {h.icon}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{h.title}</p>
                    <p className="mt-0.5 text-xs leading-5 opacity-80">{h.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="flex flex-1 flex-col px-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col pb-12 pt-10 lg:justify-center lg:py-16">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">{heading}</h2>
          {subheading && <p className="mt-1.5 text-xs leading-5 text-slate-600 dark:text-slate-400">{subheading}</p>}

          <div className="mt-8">
            {setupRequired ? (
              <Alert tone="amber">Aplikasi belum di-setup. Minta admin menyelesaikan setup di panel staf.</Alert>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {needTenant && (
                  <Field label="Kode institusi" error={fields.tenant} hint="Instalasi ini melayani beberapa institusi.">
                    <div className="relative">
                      <School className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <Input className="h-10 pl-9 font-mono text-sm" value={slug} onChange={(e) => setSlug(e.target.value)} autoComplete="organization" />
                    </div>
                  </Field>
                )}
                <Field label="Username" error={fields.username}>
                  <div className="relative">
                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="h-10 pl-9 text-sm"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      autoComplete="username"
                      autoCapitalize="none"
                      spellCheck={false}
                      autoFocus={!prefilled}
                      invalid={!!fields.username}
                      required
                    />
                  </div>
                </Field>
                <Field
                  label="Password"
                  error={fields.password}
                  hint={capsLock ? <span className="font-medium text-amber-700 dark:text-amber-400">Caps Lock menyala.</span> : undefined}
                >
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      className="h-10 pl-9 pr-10 text-sm"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={capsCheck}
                      onKeyDown={capsCheck}
                      autoComplete="current-password"
                      autoFocus={prefilled}
                      invalid={!!fields.password}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                      aria-pressed={showPassword}
                      className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-blue-500/30 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                {error && <Alert>{error}</Alert>}
                <Button type="submit" size="lg" className="mt-2 w-full" loading={busy}>
                  Masuk {!busy && <ArrowRight className="h-4 w-4" />}
                </Button>
              </form>
            )}
          </div>
          {footer && <div className="mt-8 text-xs text-slate-500 dark:text-slate-400">{footer}</div>}
        </div>
        <AppFooter className="pb-6" />
      </main>
    </div>
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
