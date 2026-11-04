import { useQuery } from '@tanstack/react-query';
import { ImageUp, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { CardInput, Tenant } from '@/shared/api/types';
import { Button, Card, Checkbox, Field, Input, Loading, PageHeader, Select, Textarea } from '@/shared/ui';
import { tenantApi } from '../api';
import { useAction } from '../components/hooks';
import { ParticipantCard } from '../components/ParticipantCard';

const zones = ['Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura', 'Asia/Singapore', 'Asia/Kuala_Lumpur', 'UTC'];

export function SettingsPage() {
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantApi.get });
  const [f, setF] = useState({ name: '', timezone: '', locale: '', primary_color: '', tagline: '', letterhead: '', exam_rules: '' });
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = tenant.data;
    if (t) setF({ name: t.name, timezone: t.settings.timezone, locale: t.settings.locale, primary_color: t.settings.primary_color ?? '', tagline: t.settings.tagline, letterhead: t.settings.letterhead, exam_rules: t.settings.exam_rules ?? '' });
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
            <Field label="Teks kop" error={fe.letterhead} hint="Dicetak di kartu ujian dan laporan, mis. alamat institusi. Maks. 500 karakter.">
              <Textarea value={f.letterhead} onChange={(e) => setF({ ...f, letterhead: e.target.value })} maxLength={500} />
            </Field>
            <Field
              label="Tata tertib ujian"
              error={fe.exam_rules}
              hint="Dicetak di lembar pengawas. Satu aturan per baris. Kosong = memakai tata tertib bawaan. Maks. 5000 karakter."
            >
              <Textarea value={f.exam_rules} onChange={(e) => setF({ ...f, exam_rules: e.target.value })} maxLength={5000} rows={6} />
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
        <CardSettingsCard tenant={t} />
      </div>
    </>
  );
}

const cardFields: { key: keyof CardInput & `show_${string}`; label: string }[] = [
  { key: 'show_external_id', label: 'ID peserta' },
  { key: 'show_exam', label: 'Nama ujian' },
  { key: 'show_session', label: 'Sesi & ruang' },
  { key: 'show_seat', label: 'Kursi' },
  { key: 'show_schedule', label: 'Jadwal' },
  { key: 'show_qr', label: 'QR halaman masuk' },
];

// sample data for the preview; the start is fixed so the card does not change while typing
const sampleParticipant = { full_name: 'Rina Wulandari', username: 'peserta001', external_id: '2026-00123', seat: 'A-12' };
const sampleSession = { exam_title: 'Tes Kompetensi Dasar', name: 'Sesi 1', room: 'Lab 2', starts_at: '2026-11-16T01:00:00Z', ends_at: '2026-11-16T03:00:00Z' };

function cardInput(t: Tenant): CardInput {
  const { signature_url: _, ...rest } = t.settings.card;
  return rest;
}

/** CardSettingsCard edits what the printed participant card shows, next to a live preview. */
function CardSettingsCard({ tenant: t }: { tenant: Tenant }) {
  const [c, setC] = useState<CardInput>(() => cardInput(t));
  const [qr, setQr] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);
  // reset the form only when the saved card settings change, not on every tenant refetch
  const saved = JSON.stringify(cardInput(t));
  useEffect(() => setC(JSON.parse(saved) as CardInput), [saved]);
  useEffect(() => {
    let alive = true;
    void import('qrcode-generator').then(({ default: qrcode }) => {
      const code = qrcode(0, 'M');
      code.addData(`${window.location.origin}/exam/login?u=${sampleParticipant.username}`);
      code.make();
      if (alive) setQr(code.createDataURL(3, 0));
    });
    return () => {
      alive = false;
    };
  }, []);
  const inv = [['tenant']];
  const save = useAction(() => tenantApi.update({ card: c }), { success: 'Pengaturan kartu disimpan', invalidate: inv, toastErrors: false });
  const sign = useAction((file: File) => tenantApi.setCardSignature(file), { success: 'Gambar tanda tangan diperbarui', invalidate: inv });
  const removeSign = useAction(() => tenantApi.removeCardSignature(), { success: 'Gambar tanda tangan dihapus', invalidate: inv });
  const fe = save.fields;
  const signature = t.settings.card.signature_url;
  const text = (key: 'title' | 'id_label' | 'note' | 'signer_title' | 'signer_name' | 'signer_number') => ({
    value: c[key],
    onChange: (e: { target: { value: string } }) => setC({ ...c, [key]: e.target.value }),
  });

  return (
    <Card title="Kartu peserta" className="lg:col-span-3">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Judul kartu" error={fe['card.title']}>
              <Input {...text('title')} maxLength={60} placeholder="Kartu Peserta Ujian" />
            </Field>
            <Field label="Label ID peserta" error={fe['card.id_label']} hint="Mis. NIS, NIP, atau No. pendaftaran.">
              <Input {...text('id_label')} maxLength={30} placeholder="ID peserta" />
            </Field>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-300">Yang tampil di kartu</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {cardFields.map((f) => (
                <Checkbox key={f.key} label={f.label} checked={c[f.key]} onChange={(e) => setC({ ...c, [f.key]: e.target.checked })} />
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Nama, username, dan password selalu tampil.</p>
          </div>

          <Field label="Catatan" error={fe['card.note']} hint="Teks pendek di bagian bawah kartu, mis. “Bawa kartu ini dan KTP saat ujian.” Maks. 300 karakter.">
            <Textarea {...text('note')} maxLength={300} rows={2} />
          </Field>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-300">Penanda tangan</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Jabatan" error={fe['card.signer_title']} hint="Usahakan singkat; teks panjang dipotong di kartu.">
                <Input {...text('signer_title')} maxLength={80} placeholder="Ketua Panitia" />
              </Field>
              <Field label="Nama" error={fe['card.signer_name']}>
                <Input {...text('signer_name')} maxLength={100} />
              </Field>
              <Field label="Nomor induk" error={fe['card.signer_number']} hint="Opsional, mis. NIP. 1980…">
                <Input {...text('signer_number')} maxLength={60} />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex h-12 w-28 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white dark:border-slate-700">
                {signature ? <img src={signature} alt="Tanda tangan" className="max-h-10 max-w-24 object-contain" /> : <span className="text-[11px] text-slate-400">Tanpa gambar</span>}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) sign.mutate(file);
                  e.target.value = '';
                }}
              />
              <Button variant="secondary" icon={<ImageUp className="h-4 w-4" />} loading={sign.isPending} onClick={() => fileRef.current?.click()}>
                {signature ? 'Ganti gambar' : 'Unggah tanda tangan/stempel'}
              </Button>
              {signature && (
                <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} loading={removeSign.isPending} onClick={() => removeSign.mutate(undefined)}>
                  Hapus
                </Button>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              PNG dengan latar transparan paling rapi. Gambar langsung tersimpan; tidak bisa dibuka tanpa login. Kosongkan jabatan, nama, dan gambar bila kartu tidak perlu tanda tangan.
            </p>
          </div>

          <div className="flex justify-end">
            <Button loading={save.isPending} onClick={() => save.mutate(undefined)}>
              Simpan pengaturan kartu
            </Button>
          </div>
        </div>

        <div className="lg:w-[95mm]">
          <p className="mb-2 text-xs font-medium text-slate-700 dark:text-slate-300">Pratinjau</p>
          {/* paper stays white in dark mode: this is what gets printed */}
          <div className="w-[95mm] max-w-full bg-white text-[11px] leading-snug text-slate-900 shadow-sm">
            <ParticipantCard
              institution={{ name: t.name, logo_url: t.settings.logo_url }}
              card={{ ...c, title: c.title || 'Kartu Peserta Ujian', id_label: c.id_label || 'ID peserta', signature_url: signature }}
              participant={sampleParticipant}
              session={sampleSession}
              password="k7m-p2qx"
              qr={qr}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Ukuran asli, 8 kartu per halaman A4. Data peserta hanya contoh.</p>
        </div>
      </div>
    </Card>
  );
}
