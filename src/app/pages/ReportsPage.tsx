import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Download, Printer, RefreshCw } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { Analysis, AnswerKey, ItemStat, Response } from '@/shared/api/types';
import { errorMessage } from '@/shared/lib/errors';
import { formatDateTime, formatNumber, formatPercent, labels } from '@/shared/lib/format';
import { Alert, Badge, Button, Card, cx, EmptyState, Loading, PageHeader, Select, Stat, Table, Tabs, td, th, useToast } from '@/shared/ui';
import { attemptApi, examApi, groupApi, reportApi, sessionApi, tenantApi } from '../api';
import { useAction } from '../components/hooks';
import { ExamChooser } from './GradingPage';

export function ReportsIndexPage() {
  return <ExamChooser title="Laporan & analisis" subtitle="Rekap nilai, ekspor Excel, dan analisis butir soal per ujian." to={(id) => `/reports/${id}`} />;
}

export function ReportPage() {
  const { examId = '' } = useParams();
  const exam = useQuery({ queryKey: ['exam', examId], queryFn: () => examApi.get(examId) });
  const sessions = useQuery({ queryKey: ['sessions', 'exam', examId], queryFn: () => sessionApi.list({ exam_id: examId, per_page: 100 }) });
  const [tab, setTab] = useState<'recap' | 'analysis'>('recap');
  const [sessionId, setSessionId] = useState('');
  if (!exam.data) return <Loading />;
  return (
    <>
      <PageHeader
        title={exam.data.title}
        subtitle="Laporan"
        back={
          <Link to="/reports" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Pilih ujian
          </Link>
        }
        actions={
          <Select className="w-auto" value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            <option value="">Semua sesi</option>
            {sessions.data?.items.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        }
      />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'recap', label: 'Rekap nilai' }, { value: 'analysis', label: 'Analisis butir' }]} />
      {tab === 'recap' ? <Recap examId={examId} sessionId={sessionId} /> : <AnalysisView examId={examId} sessionId={sessionId} />}
    </>
  );
}

function Recap({ examId, sessionId }: { examId: string; sessionId: string }) {
  const toast = useToast();
  const [groupId, setGroupId] = useState('');
  const groups = useQuery({ queryKey: ['groups', 'all'], queryFn: () => groupApi.list({ per_page: 100 }) });
  const q = { session_id: sessionId, group_id: groupId };
  const recap = useQuery({ queryKey: ['recap', examId, q], queryFn: () => reportApi.recap(examId, q) });
  const [busy, setBusy] = useState(false);
  const exportXlsx = async () => {
    setBusy(true);
    try {
      await reportApi.exportRecap(examId, q);
    } catch (err) {
      toast('error', 'Gagal mengekspor', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const r = recap.data;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select className="w-auto" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
          <option value="">Semua kelas/grup</option>
          {groups.data?.items.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <Button variant="secondary" icon={<Download className="h-4 w-4" />} loading={busy} onClick={() => void exportXlsx()}>
          Ekspor Excel
        </Button>
      </div>
      {recap.isLoading ? (
        <Loading />
      ) : recap.error ? (
        <Alert>{errorMessage(recap.error)}</Alert>
      ) : r ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Peserta" value={r.rows.length} />
            <Stat label="Dinilai" value={r.counts.graded ?? 0} tone="green" />
            <Stat label="Belum lengkap" value={(r.counts.submitted ?? 0) + (r.counts.in_progress ?? 0)} tone="amber" />
            <Stat label="Belum mulai" value={r.counts.not_started ?? 0} />
          </div>
          <p className="text-[11px] text-slate-500">
            Nilai memakai percobaan {{ highest: 'tertinggi', latest: 'terakhir', average: 'rata-rata' }[r.attempt_scoring]}
            {r.passing_score !== null && ` · KKM ${r.passing_score}`}.
          </p>
          {r.rows.length === 0 ? (
            <EmptyState title="Belum ada peserta" />
          ) : (
            <Table>
              <thead>
                <tr>
                  <th className={th}>#</th>
                  <th className={th}>Peserta</th>
                  <th className={th}>Sesi</th>
                  <th className={th}>Status</th>
                  <th className={th}>Nilai</th>
                  <th className={th}>Lulus</th>
                  <th className={th}>Dikumpulkan</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row, i) => (
                  <tr key={row.user_id}>
                    <td className={td}>{i + 1}</td>
                    <td className={td}>
                      <p className="font-semibold">{row.full_name}</p>
                      <p className="font-mono text-[11px] text-slate-500">
                        {row.username}
                        {row.external_id && ` · ${row.external_id}`}
                      </p>
                    </td>
                    <td className={td}>{row.session_name}</td>
                    <td className={td}>{labels.attemptStatus[row.status] ?? row.status}</td>
                    <td className={`${td} font-mono font-semibold`}>{formatNumber(row.score)}</td>
                    <td className={td}>{row.passed === null ? '—' : row.passed ? <Badge tone="green">Lulus</Badge> : <Badge tone="red">Belum</Badge>}</td>
                    <td className={td}>{formatDateTime(row.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      ) : null}
    </div>
  );
}

const diffTone = { easy: 'green', medium: 'blue', hard: 'red' } as const;
const discLabel = { excellent: 'Sangat baik', good: 'Baik', fair: 'Cukup', poor: 'Jelek' } as const;
const discTone = { excellent: 'green', good: 'green', fair: 'amber', poor: 'red' } as const;
const recLabel = { keep: 'Pertahankan', revise: 'Revisi', check_key: 'Periksa kunci' } as const;
const recTone = { keep: 'green', revise: 'amber', check_key: 'red' } as const;

function AnalysisView({ examId, sessionId }: { examId: string; sessionId: string }) {
  const q = { session_id: sessionId };
  const analysis = useQuery({ queryKey: ['analysis', examId, sessionId], queryFn: () => reportApi.analysis(examId, q) });
  const [data, setData] = useState<Analysis | null>(null);
  const recompute = useAction(() => reportApi.recompute(examId, q), { success: 'Analisis dihitung ulang', onSuccess: setData });
  const a = data && data.session_id === (sessionId || null) ? data : analysis.data;
  const [open, setOpen] = useState<string | null>(null);
  if (analysis.isLoading) return <Loading label="Menghitung analisis…" />;
  if (analysis.error) return <Alert>{errorMessage(analysis.error)}</Alert>;
  if (!a) return null;
  const e = a.exam;
  const maxBin = Math.max(1, ...e.distribution);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>Dihitung {formatDateTime(a.computed_at)} dari attempt pertama yang sudah dinilai per peserta.</span>
        <Button size="sm" variant="secondary" icon={<RefreshCw className="h-3.5 w-3.5" />} loading={recompute.isPending} onClick={() => recompute.mutate(undefined)}>
          Hitung ulang
        </Button>
      </div>
      {a.warnings.map((w) => (
        <Alert key={w} tone="amber">
          {w.startsWith('small_sample') ? `Sampel kecil (${e.n_attempts} peserta): statistik belum stabil di bawah 30 peserta.` : w.startsWith('reliability') ? 'Reliabilitas tidak dihitung: kurang dari 2 soal diterima semua peserta.' : w}
        </Alert>
      ))}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Peserta" value={e.n_attempts} />
        <Stat label="Rata-rata" value={formatNumber(e.mean)} tone="blue" />
        <Stat label="Simpangan baku" value={formatNumber(e.sd)} />
        <Stat label="Min – maks" value={`${formatNumber(e.min, 0)} – ${formatNumber(e.max, 0)}`} />
        <Stat label="Reliabilitas (α)" value={formatNumber(e.reliability)} tone={e.reliability !== null && e.reliability >= 0.7 ? 'green' : 'amber'} />
        <Stat label="Lulus" value={formatPercent(e.pass_rate)} tone="green" />
      </div>
      <Card title="Sebaran nilai">
        <div className="flex h-40 items-end gap-2">
          {e.distribution.map((n, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] text-slate-500">{n || ''}</span>
              <div className="w-full rounded-t-md bg-blue-500" style={{ height: `${(n / maxBin) * 100}%`, minHeight: n ? 4 : 0 }} />
              <span className="text-[10px] text-slate-500">{i * 10}</span>
            </div>
          ))}
        </div>
      </Card>
      <Table>
        <thead>
          <tr>
            <th className={th}>Soal</th>
            <th className={th}>Tipe</th>
            <th className={th}>n</th>
            <th className={th}>Tingkat kesukaran (p)</th>
            <th className={th}>Daya beda</th>
            <th className={th}>Rekomendasi</th>
          </tr>
        </thead>
        <tbody>
          {a.items.map((it) => (
            <Fragment key={it.item_version_id}>
              <tr className={cx(it.options && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50')} onClick={() => it.options && setOpen(open === it.item_version_id ? null : it.item_version_id)}>
                <td className={`${td} max-w-sm`}>
                  <span className="font-mono text-[11px] text-slate-500">{it.code ?? '—'}</span>
                  <span className="line-clamp-2 block">{it.stem_preview}</span>
                </td>
                <td className={td}>{labels.itemType[it.type]}</td>
                <td className={td}>
                  {it.n}
                  {it.omitted > 0 && <span className="text-slate-400"> ({it.omitted} kosong)</span>}
                </td>
                <td className={td}>
                  <span className="font-mono">{formatNumber(it.p_value)}</span> {it.difficulty_level && <Badge tone={diffTone[it.difficulty_level]}>{labels.difficulty[it.difficulty_level]}</Badge>}
                </td>
                <td className={td}>
                  <span className="font-mono">{formatNumber(it.discrimination)}</span>{' '}
                  {it.discrimination_level && <Badge tone={discTone[it.discrimination_level]}>{discLabel[it.discrimination_level]}</Badge>}
                </td>
                <td className={td}>{it.recommendation && <Badge tone={recTone[it.recommendation]}>{recLabel[it.recommendation]}</Badge>}</td>
              </tr>
              {open === it.item_version_id && it.options && (
                <tr>
                  <td colSpan={6} className="bg-slate-50 px-4 py-3 dark:bg-slate-800/40">
                    <Distractors item={it} />
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </Table>
      {a.items.length === 0 && <EmptyState title="Belum ada data">Analisis muncul setelah ada attempt yang selesai dinilai.</EmptyState>}
    </div>
  );
}

function Distractors({ item }: { item: ItemStat }) {
  const opts = Object.entries(item.options ?? {}).sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="space-y-1.5 text-xs">
      <p className="font-semibold">Sebaran pilihan</p>
      {opts.map(([id, o]) => (
        <div key={id} className="flex items-center gap-3">
          <span className={cx('w-10 font-mono font-bold', o.is_key && 'text-emerald-600')}>{id}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className={cx('h-full', o.is_key ? 'bg-emerald-500' : 'bg-slate-400')} style={{ width: `${o.pct * 100}%` }} />
          </div>
          <span className="w-24 text-right font-mono">
            {o.n} ({formatPercent(o.pct)})
          </span>
          <span className="w-20 text-right font-mono text-slate-500">pbis {formatNumber(o.pbis)}</span>
          <span className="w-36">
            {o.is_key && <Badge tone="green">kunci</Badge>}
            {o.flag === 'non_functional' && <Badge tone="amber">tidak berfungsi</Badge>}
            {o.flag === 'attracts_high_scorers' && (
              <Badge tone="red">
                <AlertTriangle className="h-3 w-3" /> dipilih peserta pintar
              </Badge>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function showResponse(r: Response | null): string {
  if (!r) return '—';
  if ('text' in r) return r.text;
  if ('value' in r) return r.value ? 'Benar' : 'Salah';
  return Array.isArray(r.selected) ? r.selected.join(', ') : r.selected;
}

function showKey(k: AnswerKey | null): string {
  if (!k) return '—';
  if (k.correct !== undefined) return Array.isArray(k.correct) ? k.correct.join(', ') : k.correct;
  if (k.value !== undefined) return k.value ? 'Benar' : 'Salah';
  if (k.accepted) return k.accepted.map((a) => a.value).join(' / ');
  return 'esai';
}

/** AttemptReportPage: one participant's printable report. */
export function AttemptReportPage() {
  const { id = '' } = useParams();
  const report = useQuery({ queryKey: ['attempt-report', id], queryFn: () => attemptApi.report(id) });
  const tenant = useQuery({ queryKey: ['tenant'], queryFn: tenantApi.get, retry: false });
  if (report.isLoading) return <Loading />;
  if (report.error || !report.data) return <Alert>{errorMessage(report.error)}</Alert>;
  const r = report.data;
  const violations = Object.entries(r.violations ?? {}).filter(([, n]) => n > 0);
  return (
    <div className="space-y-5">
      <div className="no-print flex items-center justify-between">
        <button type="button" onClick={() => history.back()} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Kembali
        </button>
        <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>
          Cetak / PDF
        </Button>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
          {tenant.data?.settings.logo_url && <img src={tenant.data.settings.logo_url} alt="" className="h-14 w-14 object-contain" />}
          <div>
            <p className="text-base font-extrabold">{tenant.data?.name}</p>
            {tenant.data?.settings.letterhead && <p className="whitespace-pre-line text-[11px] text-slate-500">{tenant.data.settings.letterhead}</p>}
          </div>
        </div>
        <h1 className="mt-4 text-lg font-extrabold">Laporan hasil ujian</h1>
        <div className="mt-3 grid gap-x-8 gap-y-1 text-xs sm:grid-cols-2">
          <Info k="Nama" v={r.full_name} />
          <Info k="Username / NIS" v={`${r.username}${r.external_id ? ` / ${r.external_id}` : ''}`} />
          <Info k="Ujian" v={r.exam_title} />
          <Info k="Sesi" v={`${r.session_name} · percobaan ke-${r.attempt_no}`} />
          <Info k="Mulai" v={formatDateTime(r.started_at)} />
          <Info k="Selesai" v={`${formatDateTime(r.submitted_at)}${r.duration_seconds ? ` (${Math.round(r.duration_seconds / 60)} menit)` : ''}`} />
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Nilai akhir" value={formatNumber(r.final_score)} tone="blue" />
          <Stat label="Skor" value={`${formatNumber(r.raw_score)} / ${formatNumber(r.max_score)}`} />
          <Stat label="Status" value={r.passed === null ? '—' : r.passed ? 'Lulus' : 'Belum lulus'} tone={r.passed ? 'green' : 'red'} />
          <Stat label="Esai menunggu" value={r.pending_manual} tone="amber" />
        </div>
        {violations.length > 0 && (
          <p className="mt-3 text-[11px] text-amber-700">
            Catatan pengawasan: {violations.map(([k, n]) => `${{ FOCUS_LOST: 'pindah tab', FULLSCREEN_EXIT: 'keluar layar penuh', DEVICE_CHANGED: 'ganti perangkat' }[k] ?? k} ${n}×`).join(', ')}
          </p>
        )}
        {r.sections.length > 1 && (
          <>
            <h2 className="mt-6 text-sm font-bold">Per bagian</h2>
            <table className="mt-2 w-full text-left text-xs">
              <tbody>
                {r.sections.map((s) => (
                  <tr key={s.title}>
                    <td className={td}>{s.title}</td>
                    <td className={`${td} font-mono`}>
                      {formatNumber(s.raw_score)} / {formatNumber(s.max_score)}
                    </td>
                    <td className={td}>{s.passed === null ? '' : s.passed ? 'Lulus' : 'Belum'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {r.competencies.length > 0 && (
          <>
            <h2 className="mt-6 text-sm font-bold">Penguasaan kompetensi</h2>
            <div className="mt-2 space-y-1.5">
              {r.competencies.map((c) => (
                <div key={c.competency_id} className="flex items-center gap-3 text-xs">
                  <span className="w-1/2 truncate">
                    <span className="font-mono">{c.code}</span> {c.name}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                    <div className={cx('h-full', c.percent >= 75 ? 'bg-emerald-500' : c.percent >= 50 ? 'bg-amber-500' : 'bg-rose-500')} style={{ width: `${c.percent}%` }} />
                  </div>
                  <span className="w-14 text-right font-mono">{formatNumber(c.percent, 0)}%</span>
                </div>
              ))}
            </div>
          </>
        )}
        <h2 className="mt-6 text-sm font-bold">Rincian soal</h2>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr>
              <th className={th}>No</th>
              <th className={th}>Soal</th>
              <th className={th}>Jawaban</th>
              <th className={th}>Kunci</th>
              <th className={th}>Skor</th>
              <th className={th}>Waktu</th>
            </tr>
          </thead>
          <tbody>
            {r.items.map((it) => (
              <tr key={it.position}>
                <td className={td}>{it.position}</td>
                <td className={`${td} max-w-xs`}>
                  <span className="line-clamp-2">{it.stem_preview}</span>
                </td>
                <td className={`${td} max-w-[12rem] truncate`}>{showResponse(it.response)}</td>
                <td className={td}>{showKey(it.answer_key)}</td>
                <td className={cx(td, 'font-mono', it.is_correct === true && 'text-emerald-600', it.is_correct === false && 'text-rose-600')}>
                  {it.score === null ? '…' : formatNumber(it.score)} / {formatNumber(it.max_points)}
                </td>
                <td className={td}>{it.time_spent_ms ? `${Math.round(it.time_spent_ms / 1000)} dtk` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <p>
      <span className="inline-block w-32 text-slate-500">{k}</span>
      <span className="font-semibold">{v}</span>
    </p>
  );
}
