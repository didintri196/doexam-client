import { CheckCircle2, Rocket } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { AuthShell } from '@/shared/auth/pages';
import { errorMessage, fieldErrors } from '@/shared/lib/errors';
import { Alert, Button, Field, Input } from '@/shared/ui';
import { setupApi } from '../api';

/** SetupPage runs once on a fresh installation: the institution and its first admin. */
export function SetupPage() {
  const [f, setF] = useState({ tenant_name: '', admin_full_name: '', admin_username: 'admin', admin_email: '', admin_password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (f.admin_password !== f.confirm) {
      setFields({ confirm: 'tidak sama' });
      return;
    }
    setBusy(true);
    setError(null);
    setFields({});
    try {
      await setupApi.setup({
        tenant_name: f.tenant_name,
        admin_full_name: f.admin_full_name,
        admin_username: f.admin_username,
        admin_email: f.admin_email || undefined,
        admin_password: f.admin_password,
      });
      setDone(true);
    } catch (err) {
      setFields(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="space-y-5 rounded-3xl border border-slate-200 bg-white px-6 py-8 shadow-xl sm:px-10 dark:border-slate-800 dark:bg-slate-900">
          {done ? (
            <div className="space-y-3 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
              <h1 className="text-lg font-semibold">Setup selesai</h1>
              <p className="text-xs text-slate-500">Masuk dengan akun admin yang baru dibuat.</p>
              <Link to="/login" className="inline-block rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-accent-fg hover:bg-blue-700">
                Ke halaman login
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-1 text-center">
                <Rocket className="mx-auto h-8 w-8 text-blue-600" />
                <h1 className="text-lg font-semibold">Setup DoExam</h1>
                <p className="text-xs text-slate-500">Isi data institusi dan akun admin pertama. Langkah ini hanya sekali.</p>
              </div>
              <form onSubmit={submit} className="space-y-4">
                <Field label="Nama institusi" error={fields.tenant_name}>
                  <Input value={f.tenant_name} onChange={set('tenant_name')} placeholder="Nama sekolah, kampus, perusahaan, atau lembaga" required />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nama admin" error={fields.admin_full_name}>
                    <Input value={f.admin_full_name} onChange={set('admin_full_name')} required />
                  </Field>
                  <Field label="Username admin" error={fields.admin_username}>
                    <Input value={f.admin_username} onChange={set('admin_username')} className="font-mono" required />
                  </Field>
                </div>
                <Field label="Email (opsional)" error={fields.admin_email}>
                  <Input type="email" value={f.admin_email} onChange={set('admin_email')} />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Password" error={fields.admin_password} hint="Minimal 8 karakter.">
                    <Input type="password" value={f.admin_password} onChange={set('admin_password')} minLength={8} required autoComplete="new-password" />
                  </Field>
                  <Field label="Ulangi password" error={fields.confirm}>
                    <Input type="password" value={f.confirm} onChange={set('confirm')} required autoComplete="new-password" />
                  </Field>
                </div>
                {error && <Alert>{error}</Alert>}
                <Button type="submit" size="lg" className="w-full" loading={busy}>
                  Selesaikan setup
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </AuthShell>
  );
}
