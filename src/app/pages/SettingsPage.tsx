import { useQuery } from '@tanstack/react-query';
import { ImageUp, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, Field, Input, Loading, PageHeader, Select, Textarea } from '@/shared/ui';
import { tenantApi } from '../api';
import { useAction } from '../components/hooks';

const zones = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'UTC'];

export function SettingsPage() {
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantApi.get });
  const [f, setF] = useState({ name: '', timezone: '', locale: '', primary_color: '', tagline: '', letterhead: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = tenant.data;
    if (t) setF({ name: t.name, timezone: t.settings.timezone, locale: t.settings.locale, primary_color: t.settings.primary_color ?? '', tagline: t.settings.tagline, letterhead: t.settings.letterhead });
  }, [tenant.data]);
  const inv = [['tenant'], ['public-tenant']];
  const save = useAction(() => tenantApi.update(f), { success: 'Pengaturan disimpan', invalidate: inv, toastErrors: false });
  const logo = useAction((file: File) => tenantApi.setLogo(file), { success: 'Logo diperbarui', invalidate: inv });
  const removeLogo = useAction(() => tenantApi.removeLogo(), { success: 'Logo dihapus', invalidate: inv });
  if (tenant.isLoading || !tenant.data) return <Loading />;
  const t = tenant.data;
  const fe = save.fields;

  return (
    <>
      <PageHeader title="Pengaturan institusi" subtitle={`Kode institusi: ${t.slug}`} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Profil" className="lg:col-span-2">
          <div className="space-y-4">
            <Field label="Nama institusi" error={fe.name}>
              <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Sub judul" error={fe.tagline} hint="Tampil di bawah nama institusi pada header dan halaman login. Kosongkan bila tidak perlu. Maks. 100 karakter.">
              <Input value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} maxLength={100} placeholder="Sistem Ujian Online" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Zona waktu" error={fe.timezone}>
                <Select value={f.timezone} onChange={(e) => setF({ ...f, timezone: e.target.value })}>
                  {[...new Set([f.timezone, ...zones])].filter(Boolean).map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Bahasa" error={fe.locale}>
                <Select value={f.locale} onChange={(e) => setF({ ...f, locale: e.target.value })}>
                  <option value="id">Indonesia</option>
                  <option value="en">English</option>
                </Select>
              </Field>
              <Field label="Warna utama" error={fe.primary_color}>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={f.primary_color || '#2563eb'}
                    onChange={(e) => setF({ ...f, primary_color: e.target.value })}
                    className="h-9 w-10 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700"
                  />
                  <Input value={f.primary_color} onChange={(e) => setF({ ...f, primary_color: e.target.value })} placeholder="#2563eb" className="font-mono" />
                </div>
              </Field>
            </div>
            <Field label="Teks kop" error={fe.letterhead} hint="Dicetak di kartu ujian dan laporan, mis. alamat sekolah. Maks. 500 karakter.">
              <Textarea value={f.letterhead} onChange={(e) => setF({ ...f, letterhead: e.target.value })} maxLength={500} />
            </Field>
            <div className="flex justify-end">
              <Button loading={save.isPending} onClick={() => save.mutate(undefined)}>
                Simpan
              </Button>
            </div>
          </div>
        </Card>
        <Card title="Logo">
          <div className="flex flex-col items-center gap-4">
            <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
              {t.settings.logo_url ? <img src={t.settings.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" /> : <span className="text-xs text-slate-400">Belum ada logo</span>}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) logo.mutate(file);
                e.target.value = '';
              }}
            />
            <div className="flex gap-2">
              <Button icon={<ImageUp className="h-4 w-4" />} loading={logo.isPending} onClick={() => fileRef.current?.click()}>
                Unggah
              </Button>
              {t.settings.logo_url && (
                <Button variant="secondary" icon={<Trash2 className="h-4 w-4" />} loading={removeLogo.isPending} onClick={() => removeLogo.mutate(undefined)}>
                  Hapus
                </Button>
              )}
            </div>
            <p className="text-center text-[11px] text-slate-500">PNG, JPEG, atau WebP, maks. 1 MB. Tampil di halaman login dan header.</p>
          </div>
        </Card>
      </div>
    </>
  );
}
