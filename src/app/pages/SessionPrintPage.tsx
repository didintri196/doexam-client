import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, KeyRound, Printer } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { PrintParticipant, SessionPrint } from '@/shared/api/types';
import { errorMessage } from '@/shared/lib/errors';
import { formatLongDate, formatNumber, formatTime } from '@/shared/lib/format';
import { Alert, Button, Checkbox, ConfirmDialog, Loading, Tabs } from '@/shared/ui';
import { sessionApi } from '../api';
import { useAction } from '../components/hooks';
import { ParticipantCard } from '../components/ParticipantCard';
import { Perm, useCan } from '../perm';

export type PrintDoc = 'cards' | 'attendance' | 'minutes' | 'proctor';

export const printDocs: { value: PrintDoc; label: string }[] = [
  { value: 'cards', label: 'Kartu peserta' },
  { value: 'attendance', label: 'Daftar hadir' },
  { value: 'minutes', label: 'Berita acara' },
  { value: 'proctor', label: 'Lembar pengawas' },
];

const defaultRules = [
  'Peserta hadir paling lambat 15 menit sebelum ujian dimulai dan membawa kartu peserta.',
  'Tas, buku, dan catatan diletakkan di tempat yang ditentukan pengawas.',
  'Ponsel dan perangkat lain dimatikan kecuali dipakai untuk mengerjakan ujian.',
  'Peserta masuk dengan akun sendiri dan tidak meminjamkan akun kepada orang lain.',
  'Selama ujian, peserta tidak berkomunikasi dengan peserta lain dan tidak membuka aplikasi atau situs lain.',
  'Bila ada kendala (perangkat, jaringan, audio), angkat tangan dan beri tahu pengawas.',
  'Peserta meninggalkan ruangan setelah mengumpulkan ujian, dengan tertib.',
];

const emergency: [string, string][] = [
  ['Peserta tidak bisa masuk', 'Periksa username di kartu. Password yang lupa di-reset oleh admin (menu Pengguna).'],
  ['Perangkat rusak atau diganti', 'Monitor → tindakan peserta → Reset perangkat, lalu peserta masuk di perangkat lain. Jawaban tidak hilang.'],
  ['Jaringan putus', 'Peserta tetap mengerjakan; jawaban tersimpan di perangkat dan terkirim saat koneksi kembali. Jangan tutup tab.'],
  ['Waktu peserta terpotong', 'Monitor → Tambah waktu (tidak bisa melewati akhir sesi).'],
  ['Audio gagal diputar', 'Periksa speaker/headset, lalu Monitor → Tambah 1× putar audio.'],
  ['Kecurangan', 'Monitor → Kunci untuk menghentikan sementara; catat di berita acara.'],
  ['Ujian selesai', 'Pastikan semua peserta mengumpulkan, lalu Tutup sesi. Peserta yang belum mengumpulkan dikumpulkan otomatis.'],
];

/** SessionPrintPage renders one session document on A4 paper; the browser prints or saves it as PDF. */
export function SessionPrintPage() {
  const { id = '', doc = 'cards' } = useParams();
  const navigate = useNavigate();
  const data = useQuery({ queryKey: ['session', id, 'print'], queryFn: () => sessionApi.print(id) });
  // card passwords live only in this page's memory: they are shown once by the server
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const current = (printDocs.some((d) => d.value === doc) ? doc : 'cards') as PrintDoc;
  const label = printDocs.find((d) => d.value === current)!.label;

  useEffect(() => {
    if (data.data) document.title = `${label} — ${data.data.session.exam.title} — ${data.data.session.name}`;
  }, [data.data, label]);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 print:bg-white">
      <div className="no-print sticky top-0 z-10 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 pt-3">
          <Link to={`/sessions/${id}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Kembali ke sesi
          </Link>
          <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()} disabled={!data.data}>
            Cetak / simpan PDF
          </Button>
        </div>
        <div className="mx-auto max-w-[210mm] px-4 pt-2 [&>div]:mb-0">
          <Tabs value={current} onChange={(v) => navigate(`/sessions/${id}/print/${v}`, { replace: true })} items={printDocs} />
        </div>
      </div>
      <div className="py-6 print:py-0">
        {data.isLoading ? (
          <Loading />
        ) : data.error || !data.data ? (
          <div className="mx-auto max-w-md p-6">
            <Alert>{errorMessage(data.error)}</Alert>
          </div>
        ) : (
          <>
          {current === 'cards' && <CardPasswordPanel sessionId={id} count={data.data.participants.length} onDone={setPasswords} given={Object.keys(passwords).length} />}
          <div className="paper mx-auto shadow-lg">
            {current === 'cards' && <Cards d={data.data} passwords={passwords} />}
            {current === 'attendance' && <Attendance d={data.data} />}
            {current === 'minutes' && <Minutes d={data.data} />}
            {current === 'proctor' && <ProctorSheet d={data.data} />}
          </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Letterhead: logo, institution, letterhead text, then the document title. */
function Letterhead({ d, title, subtitle }: { d: SessionPrint; title: string; subtitle?: ReactNode }) {
  const inst = d.institution;
  return (
    <header className="mb-5">
      <div className="flex items-center gap-4 border-b-2 border-slate-800 pb-3">
        {inst.logo_url && <img src={inst.logo_url} alt="" className="h-14 w-14 shrink-0 object-contain" />}
        <div className="min-w-0">
          <p className="text-[15px] font-bold uppercase tracking-wide">{inst.name}</p>
          {inst.letterhead && <p className="whitespace-pre-line text-[11px] leading-snug text-slate-600">{inst.letterhead}</p>}
        </div>
      </div>
      <div className="mt-4 text-center">
        <h1 className="text-[15px] font-bold uppercase tracking-wide">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[12px] text-slate-600">{subtitle}</p>}
      </div>
    </header>
  );
}

function sessionLine(d: SessionPrint): string {
  const s = d.session;
  return `${s.exam.title} · ${s.name}${s.room ? ` · Ruang ${s.room}` : ''}`;
}

function schedule(d: SessionPrint): string {
  const s = d.session;
  return `${formatLongDate(s.starts_at)}, ${formatTime(s.starts_at)}–${formatTime(s.ends_at)}`;
}

// ── kartu peserta ────────────────────────────────────────────
function useQrCodes(participants: PrintParticipant[]): Record<string, string> {
  const [codes, setCodes] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    void import('qrcode-generator').then(({ default: qrcode }) => {
      const out: Record<string, string> = {};
      for (const p of participants) {
        const qr = qrcode(0, 'M');
        qr.addData(`${window.location.origin}/exam/login?u=${encodeURIComponent(p.username)}`);
        qr.make();
        out[p.user_id] = qr.createDataURL(3, 0);
      }
      if (alive) setCodes(out);
    });
    return () => {
      alive = false;
    };
  }, [participants]);
  return codes;
}

function Cards({ d, passwords }: { d: SessionPrint; passwords: Record<string, string> }) {
  const card = d.institution.card;
  const qr = useQrCodes(card.show_qr ? d.participants : noParticipants);
  if (!d.participants.length) return <Empty />;
  const s = d.session;
  const session = { exam_title: s.exam.title, name: s.name, room: s.room, starts_at: s.starts_at, ends_at: s.ends_at };
  return (
    <div className="card-grid text-[11px] leading-snug">
      {d.participants.map((p) => (
        <ParticipantCard key={p.user_id} institution={d.institution} card={card} participant={p} session={session} password={passwords[p.user_id]} qr={qr[p.user_id]} />
      ))}
    </div>
  );
}

const noParticipants: PrintParticipant[] = [];

/**
 * CardPasswordPanel (screen only) asks the server for new system passwords and puts them
 * on the cards. Participants keep these passwords; the old ones stop working.
 */
function CardPasswordPanel({ sessionId, count, given, onDone }: { sessionId: string; count: number; given: number; onDone: (p: Record<string, string>) => void }) {
  const can = useCan();
  const [onlyNew, setOnlyNew] = useState(true);
  const [confirm, setConfirm] = useState(false);
  const [skipped, setSkipped] = useState<number | null>(null);
  const run = useAction(() => sessionApi.cardPasswords(sessionId, onlyNew), {
    success: (r) => `${formatNumber(r.passwords.length)} password dibuat`,
    onSuccess: (r) => {
      onDone(Object.fromEntries(r.passwords.map((x) => [x.user_id, x.password])));
      setSkipped(r.skipped);
      setConfirm(false);
    },
  });
  if (!can(Perm.UserManage) || !count) return null;
  return (
    <div className="no-print mx-auto mb-4 max-w-[210mm] px-4 sm:px-0">
      {given > 0 ? (
        <Alert tone="amber">
          <strong>{formatNumber(given)} password tercetak di kartu.</strong> Password hanya tampil sekarang: cetak atau simpan PDF sebelum menutup halaman ini.
          {skipped ? ` ${formatNumber(skipped)} peserta dilewati (sudah pernah login atau akun nonaktif), kartunya berisi baris kosong.` : ''}
        </Alert>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-0 text-xs text-slate-600 dark:text-slate-300">
            <p className="font-semibold text-slate-900 dark:text-white">Password di kartu</p>
            <p>Sistem membuat password untuk setiap peserta dan mencetaknya di kartu. Peserta memakainya langsung, tanpa harus mengganti.</p>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <Checkbox label="Hanya yang belum pernah login" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} />
            <Button icon={<KeyRound className="h-4 w-4" />} onClick={() => setConfirm(true)}>
              Buat password
            </Button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={confirm}
        title="Buat password baru untuk kartu?"
        confirmLabel="Buat password"
        loading={run.isPending}
        onConfirm={() => run.mutate(undefined)}
        onClose={() => setConfirm(false)}
      >
        {onlyNew ? 'Peserta yang belum pernah login' : 'Semua peserta aktif di sesi ini'} mendapat password baru dari sistem. Password lama mereka tidak berlaku lagi, dan
        kartu yang sudah dibagikan sebelumnya perlu dicetak ulang. Password hanya tampil sekali.
      </ConfirmDialog>
    </div>
  );
}

// ── daftar hadir ─────────────────────────────────────────────
function Attendance({ d }: { d: SessionPrint }) {
  return (
    <>
      <Letterhead d={d} title="Daftar Hadir Peserta" subtitle={`${sessionLine(d)} · ${schedule(d)}`} />
      {!d.participants.length ? (
        <Empty />
      ) : (
        <table className="text-[11px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="w-[9mm] text-center">No</th>
              <th>Nama</th>
              <th className="w-[34mm]">Username / ID</th>
              <th className="w-[14mm] text-center">Kursi</th>
              <th className="w-[38mm]">Tanda tangan</th>
              <th className="w-[26mm]">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            {d.participants.map((p, i) => (
              <tr key={p.user_id} className="h-[10mm]">
                <td className="text-center tabular-nums">{i + 1}</td>
                <td className="font-medium">{p.full_name}</td>
                <td className="font-mono text-[10px]">
                  {p.username}
                  {p.external_id && <span className="block text-slate-500">{p.external_id}</span>}
                </td>
                <td className="text-center tabular-nums">{p.seat ?? ''}</td>
                <td>
                  <span className={i % 2 ? 'pl-[19mm]' : ''}>
                    <span className="text-[9px] text-slate-400">{i + 1}.</span>
                  </span>
                </td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Signatures d={d} />
    </>
  );
}

// ── berita acara ─────────────────────────────────────────────
function Minutes({ d }: { d: SessionPrint }) {
  const s = d.session;
  const st = d.stats;
  const missing = d.participants.filter((p) => p.attendance !== 'present' && !p.attempt_status);
  const rows: [string, number][] = [
    ['Peserta terdaftar', st.registered],
    ['Hadir', st.present],
    ['Tidak hadir', st.absent],
    ['Izin / berhalangan', st.excused],
    ['Belum tercatat', Math.max(0, st.registered - st.present - st.absent - st.excused)],
    ['Mulai mengerjakan', st.started],
    ['Mengumpulkan', st.submitted],
  ];
  return (
    <>
      <Letterhead d={d} title="Berita Acara Pelaksanaan Ujian" />
      <div className="space-y-4 text-[12px] leading-relaxed">
        <p>
          Pada hari ini, <strong>{formatLongDate(s.starts_at)}</strong>, pukul{' '}
          <strong className="tabular-nums">
            {formatTime(s.starts_at)}–{formatTime(s.ends_at)}
          </strong>
          , telah dilaksanakan ujian <strong>{s.exam.title}</strong>, sesi <strong>{s.name}</strong>
          {s.room && (
            <>
              {' '}
              di ruang <strong>{s.room}</strong>
            </>
          )}
          , dengan rincian sebagai berikut.
        </p>
        <table className="w-[110mm] text-[12px]">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td className="w-[60mm]">{k}</td>
                <td className="w-[25mm] text-right font-semibold tabular-nums">{formatNumber(v)} orang</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="avoid-break">
          <p className="font-semibold">Peserta yang tidak hadir atau belum mengerjakan</p>
          {missing.length ? (
            <ol className="mt-1 list-decimal pl-6">
              {missing.map((p) => (
                <li key={p.user_id}>
                  {p.full_name} <span className="font-mono text-[11px] text-slate-600">({p.external_id ?? p.username})</span>
                  {p.attendance === 'excused' && ' — izin'}
                  {p.attendance === 'absent' && ' — tidak hadir'}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-slate-600">Tidak ada.</p>
          )}
        </div>
        <div className="avoid-break">
          <p className="font-semibold">Catatan kejadian selama ujian</p>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="h-[8mm] border-b border-dotted border-slate-400" />
          ))}
        </div>
        <p>Berita acara ini dibuat dengan sebenarnya untuk dipergunakan sebagaimana mestinya.</p>
      </div>
      <Signatures d={d} />
    </>
  );
}

// ── lembar pengawas ──────────────────────────────────────────
function ProctorSheet({ d }: { d: SessionPrint }) {
  const s = d.session;
  const rules = d.institution.exam_rules.trim() ? d.institution.exam_rules.split('\n').map((r) => r.trim()).filter(Boolean) : defaultRules;
  const info: [string, ReactNode][] = [
    ['Ujian', s.exam.title],
    ['Sesi', s.name],
    ['Ruang', s.room ?? '—'],
    ['Jadwal', schedule(d)],
    ['Durasi ujian', s.exam.total_minutes ? `${s.exam.total_minutes} menit` : 'mengikuti sesi'],
    ['Batas masuk terlambat', s.late_entry_minutes != null ? `${s.late_entry_minutes} menit setelah mulai` : 'sampai sesi berakhir'],
    ['Token ruang', s.token_required ? `Wajib — tampilkan dari menu Token (berganti tiap ${s.token_rotation_minutes} menit)` : 'Tidak dipakai'],
    ['Peserta terdaftar', `${formatNumber(d.stats.registered)} orang`],
    ['Halaman peserta', `${window.location.host}/exam`],
  ];
  return (
    <>
      <Letterhead d={d} title="Lembar Pengawas" subtitle={sessionLine(d)} />
      <div className="space-y-5 text-[12px] leading-relaxed">
        <table className="text-[12px]">
          <tbody>
            {info.map(([k, v]) => (
              <tr key={k}>
                <td className="w-[48mm] bg-slate-50 font-medium">{k}</td>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <section className="avoid-break">
          <h2 className="mb-1 text-[13px] font-bold">Pengawas</h2>
          {s.proctors.length ? (
            <ol className="list-decimal pl-6">
              {s.proctors.map((p) => (
                <li key={p.user_id}>
                  {p.full_name} <span className="font-mono text-[11px] text-slate-600">({p.username})</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-slate-600">Belum ada pengawas yang ditugaskan.</p>
          )}
        </section>
        <section className="avoid-break">
          <h2 className="mb-1 text-[13px] font-bold">Tata tertib peserta</h2>
          <ol className="list-decimal space-y-0.5 pl-6">
            {rules.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </section>
        <section className="avoid-break">
          <h2 className="mb-1 text-[13px] font-bold">Bila ada kendala</h2>
          <table className="text-[11px]">
            <tbody>
              {emergency.map(([k, v]) => (
                <tr key={k}>
                  <td className="w-[48mm] font-medium">{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}

/** Signatures: one column per proctor (at least one blank), dated at the session's place. */
function Signatures({ d }: { d: SessionPrint }) {
  const names = d.session.proctors.length ? d.session.proctors.map((p) => p.full_name) : [''];
  return (
    <div className="avoid-break mt-8 text-[12px]">
      <p className="mb-2 text-right">{formatLongDate(d.session.starts_at)}</p>
      <div className="grid grid-cols-2 gap-x-10 gap-y-6">
        {names.map((n, i) => (
          // a single signer sits on the right, as on formal documents
          <div key={i} className={names.length === 1 ? 'col-start-2 text-center' : 'text-center'}>
            <p>Pengawas{names.length > 1 ? ` ${i + 1}` : ''}</p>
            <div className="h-[20mm]" />
            <p className="border-t border-slate-500 pt-1 font-semibold">{n || ' '}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty() {
  return <p className="py-10 text-center text-[12px] text-slate-500">Sesi ini belum punya peserta.</p>;
}
