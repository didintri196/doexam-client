import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, CheckSquare, ChevronRight, EyeOff, Plus, Undo2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { AdjustmentAction, AnswerKey, Exam, GradingQueueRow, Response } from '@/shared/api/types';
import { RichContent } from '@/shared/item/RichContent';
import { formatDateTime, formatNumber, labels } from '@/shared/lib/format';
import { Alert, Badge, Button, Card, Checkbox, ConfirmDialog, cx, EmptyState, Field, Input, Loading, Modal, PageHeader, Pagination, Select, Table, Tabs, td, Textarea, th } from '@/shared/ui';
import { examApi, gradingApi, itemApi } from '../api';
import { useAction } from '../components/hooks';
import { SearchInput, useDebounced } from '../components/pickers';
import { examTone } from './ExamsPage';

/** ExamChooser lists published/archived exams for post-exam pages. */
export function ExamChooser({ title, subtitle, to }: { title: string; subtitle: string; to: (id: string) => string }) {
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const list = useQuery({ queryKey: ['exams', 'post', dq, page], queryFn: () => examApi.list({ q: dq, page, per_page: 10 }) });
  const items = (list.data?.items ?? []).filter((e) => e.status !== 'draft');
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="mb-4">
        <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} placeholder="Cari ujian…" />
      </div>
      {list.isLoading ? (
        <Loading />
      ) : !items.length ? (
        <EmptyState icon={<CheckSquare className="h-10 w-10" />} title="Belum ada ujian yang terbit" />
      ) : (
        <>
          <div className="space-y-2">
            {items.map((e) => (
              <Link key={e.id} to={to(e.id)} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{e.title}</p>
                  <p className="text-[11px] text-slate-500">Terbit {formatDateTime(e.published_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={examTone[e.status]}>{labels.examStatus[e.status]}</Badge>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              </Link>
            ))}
          </div>
          <Pagination page={page} perPage={10} total={list.data?.total ?? 0} onPage={setPage} />
        </>
      )}
    </>
  );
}

export function GradingIndexPage() {
  return <ExamChooser title="Koreksi & regrade" subtitle="Pilih ujian untuk menilai esai atau menganulir/mengganti kunci soal." to={(id) => `/grading/${id}`} />;
}

export function GradingPage() {
  const { examId = '' } = useParams();
  const exam = useQuery({ queryKey: ['exam', examId], queryFn: () => examApi.get(examId) });
  const [tab, setTab] = useState<'essay' | 'adjust'>('essay');
  if (!exam.data) return <Loading />;
  return (
    <>
      <PageHeader
        title={exam.data.title}
        subtitle="Koreksi & regrade"
        back={
          <Link to="/grading" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Pilih ujian
          </Link>
        }
      />
      <Tabs value={tab} onChange={setTab} items={[{ value: 'essay', label: 'Koreksi esai' }, { value: 'adjust', label: 'Anulir / ganti kunci' }]} />
      {tab === 'essay' ? <EssayGrading examId={examId} /> : <Adjustments exam={exam.data} />}
    </>
  );
}

// ── essays ─────────────────────────────────────────────────────
function EssayGrading({ examId }: { examId: string }) {
  const summary = useQuery({ queryKey: ['grading', examId, 'summary'], queryFn: () => gradingApi.summary(examId) });
  const [versionId, setVersionId] = useState<string>('');
  const [status, setStatus] = useState('pending');
  const [blind, setBlind] = useState(true);
  const [page, setPage] = useState(1);
  const [current, setCurrent] = useState<string | null>(null);
  const queue = useQuery({
    queryKey: ['grading', examId, 'queue', versionId, status, blind, page],
    queryFn: () => gradingApi.queue(examId, { item_version_id: versionId, status, blind, page, per_page: 10 }),
    enabled: !!versionId,
  });
  useEffect(() => {
    if (!versionId && summary.data?.length) setVersionId(summary.data[0].item_version_id);
  }, [summary.data, versionId]);

  if (summary.isLoading) return <Loading />;
  if (!summary.data?.length) return <EmptyState icon={<CheckCircle2 className="h-10 w-10" />} title="Tidak ada esai di ujian ini" />;
  const rows = queue.data?.items ?? [];
  const next = () => {
    const i = rows.findIndex((r) => r.attempt_item_id === current);
    const after = rows.slice(i + 1).find((r) => r.score_source !== 'manual');
    setCurrent(after?.attempt_item_id ?? null);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4">
        <Card title="Soal esai">
          <div className="space-y-1">
            {summary.data.map((s) => (
              <button
                key={s.item_version_id}
                type="button"
                onClick={() => (setVersionId(s.item_version_id), setPage(1), setCurrent(null))}
                className={cx(
                  'w-full rounded-lg px-3 py-2 text-left text-xs',
                  versionId === s.item_version_id ? 'bg-blue-50 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200' : 'hover:bg-slate-50 dark:hover:bg-slate-800',
                )}
              >
                <span className="line-clamp-2 font-medium">{s.code && <span className="font-mono">{s.code} · </span>}{s.stem_preview}</span>
                <span className="mt-1 flex gap-2 text-[11px]">
                  <Badge tone={s.pending ? 'amber' : 'green'}>{s.pending} menunggu</Badge>
                  <Badge>{s.graded} dinilai</Badge>
                </span>
              </button>
            ))}
          </div>
        </Card>
        <Card title="Jawaban">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Select className="w-auto" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
              <option value="pending">Menunggu</option>
              <option value="graded">Sudah dinilai</option>
              <option value="all">Semua</option>
            </Select>
            <Checkbox label="Sembunyikan nama" checked={blind} onChange={(e) => setBlind(e.target.checked)} />
          </div>
          {queue.isLoading ? (
            <Loading />
          ) : !rows.length ? (
            <p className="text-xs text-slate-500">Tidak ada jawaban.</p>
          ) : (
            <div className="space-y-1">
              {rows.map((r, i) => (
                <QueueRow key={r.attempt_item_id} row={r} index={(page - 1) * 20 + i + 1} active={current === r.attempt_item_id} onClick={() => setCurrent(r.attempt_item_id)} />
              ))}
              <Pagination page={page} perPage={10} total={queue.data?.total ?? 0} onPage={setPage} />
            </div>
          )}
        </Card>
      </div>
      <div className="lg:col-span-2">
        {current ? (
          <GradePanel key={current} attemptItemId={current} examId={examId} onNext={next} />
        ) : (
          <Card>
            <EmptyState title="Pilih jawaban untuk dinilai">Penilaian disimpan per jawaban; nilai akhir peserta dihitung ulang otomatis.</EmptyState>
          </Card>
        )}
      </div>
    </div>
  );
}

function QueueRow({ row, index, active, onClick }: { row: GradingQueueRow; index: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx('flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs', active ? 'bg-blue-600 text-accent-fg' : 'hover:bg-slate-50 dark:hover:bg-slate-800')}
    >
      <span className="flex items-center gap-1.5">
        {row.full_name ? row.full_name : (
          <>
            <EyeOff className="h-3 w-3" /> Jawaban #{index}
          </>
        )}
      </span>
      <span className="font-mono">{row.score_source === 'manual' ? `${formatNumber(row.score)}/${formatNumber(row.max_points)}` : '—'}</span>
    </button>
  );
}

function responseText(r: Response | null): string {
  if (!r) return '';
  if ('text' in r) return r.text;
  return JSON.stringify(r);
}

function GradePanel({ attemptItemId, examId, onNext }: { attemptItemId: string; examId: string; onNext: () => void }) {
  const qc = useQueryClient();
  const item = useQuery({ queryKey: ['grading-item', attemptItemId], queryFn: () => gradingApi.item(attemptItemId) });
  const [score, setScore] = useState('');
  const [rubric, setRubric] = useState<Record<string, string>>({});
  const [comment, setComment] = useState('');
  const g = item.data;
  useEffect(() => {
    if (!g) return;
    const last = g.history[0];
    setScore(g.score_source === 'manual' && g.score !== null ? String(g.score) : '');
    setRubric(Object.fromEntries((last?.rubric_scores ?? []).map((r) => [r.criterion, String(r.score)])));
    setComment(last?.comment ?? '');
  }, [g]);
  const hasRubric = !!g?.rubric?.length;
  const rubricTotal = useMemo(() => Object.values(rubric).reduce((a, b) => a + (Number(b) || 0), 0), [rubric]);
  const save = useAction(
    () =>
      gradingApi.grade(attemptItemId, {
        ...(hasRubric ? { rubric_scores: g!.rubric!.map((r) => ({ criterion: r.criterion, score: Number(rubric[r.criterion] || 0) })) } : { score: Number(score) }),
        ...(comment ? { comment } : {}),
      }),
    {
      success: 'Nilai disimpan',
      onSuccess: (r) => {
        qc.setQueryData(['grading-item', attemptItemId], r);
        void qc.invalidateQueries({ queryKey: ['grading', examId] });
        onNext();
      },
    },
  );
  if (!g) return <Loading />;
  const text = responseText(g.response);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="space-y-4">
      <Card title="Soal">
        <RichContent html={g.stem} className="text-sm" />
        {g.model_answer && (
          <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs dark:bg-emerald-950/30">
            <p className="mb-1 font-semibold text-emerald-700 dark:text-emerald-300">Jawaban model</p>
            <RichContent html={g.model_answer} />
          </div>
        )}
      </Card>
      <Card title={`Jawaban peserta (${words} kata)`}>
        {text ? <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">{text}</p> : <p className="text-xs italic text-slate-500">Kosong.</p>}
      </Card>
      <Card title={`Nilai (maks. ${formatNumber(g.max_points)})`}>
        <div className="space-y-4">
          {hasRubric ? (
            <div className="space-y-2">
              {g.rubric!.map((r) => (
                <div key={r.criterion} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex-1">{r.criterion}</span>
                  <Input type="number" min={0} max={r.max} step="0.5" className="w-24" value={rubric[r.criterion] ?? ''} onChange={(e) => setRubric({ ...rubric, [r.criterion]: e.target.value })} />
                  <span className="w-12 text-slate-500">/ {r.max}</span>
                </div>
              ))}
              <p className="text-right text-xs text-slate-500">Total rubrik {formatNumber(rubricTotal)} — diskalakan ke {formatNumber(g.max_points)} poin.</p>
            </div>
          ) : (
            <Field label="Skor">
              <Input type="number" min={0} max={g.max_points} step="0.5" className="w-32" value={score} onChange={(e) => setScore(e.target.value)} autoFocus />
            </Field>
          )}
          <Field label="Komentar (opsional)">
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
          </Field>
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">Nilai akhir peserta saat ini: {formatNumber(g.attempt_final_score)}</span>
            <Button loading={save.isPending} disabled={!hasRubric && score === ''} onClick={() => save.mutate(undefined)}>
              Simpan & berikutnya
            </Button>
          </div>
          {g.history.length > 0 && (
            <div className="border-t border-slate-100 pt-3 text-[11px] text-slate-500 dark:border-slate-800">
              <p className="mb-1 font-semibold">Riwayat penilaian</p>
              {g.history.map((h, i) => (
                <p key={i}>
                  {formatDateTime(h.created_at)} · {h.grader_name}: {formatNumber(h.score)}
                  {h.comment && ` — ${h.comment}`}
                </p>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ── adjustments ────────────────────────────────────────────────
const actionLabel: Record<AdjustmentAction, string> = {
  annul_full_credit: 'Anulir — semua peserta dapat poin penuh',
  annul_remove: 'Anulir — soal tidak dihitung',
  override_key: 'Ganti kunci jawaban',
};

function Adjustments({ exam }: { exam: Exam }) {
  const [page, setPage] = useState(1);
  const list = useQuery({
    queryKey: ['adjustments', exam.id, page],
    queryFn: () => gradingApi.adjustments(exam.id, { page, per_page: 10 }),
    placeholderData: keepPreviousData, // the table stays while the next page loads
  });
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const items = exam.sections.flatMap((s) => s.items);
  const label = (vid: string) => {
    const it = items.find((i) => i.version_id === vid);
    return it ? `${it.code ?? '—'} · ${it.stem_preview}` : vid.slice(0, 8);
  };
  const revoke = useAction((id: string) => gradingApi.revokeAdjustment(id), {
    success: (a) => `Penyesuaian dicabut, ${a.regraded ?? 0} attempt dinilai ulang`,
    invalidate: [['adjustments']],
    onSuccess: () => setRevoking(null),
  });
  return (
    <div className="space-y-4">
      <Alert tone="blue">Penyesuaian menilai ulang semua peserta yang menerima soal itu. Soal di bank soal tidak berubah, dan penyesuaian bisa dicabut kapan saja.</Alert>
      <div className="flex justify-end">
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)} disabled={!items.length}>
          Penyesuaian baru
        </Button>
      </div>
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.total ? (
        <EmptyState title="Belum ada penyesuaian" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th className={th}>Soal</th>
              <th className={th}>Tindakan</th>
              <th className={th}>Alasan</th>
              <th className={th}>Waktu</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {list.data.items.map((a) => (
              <tr key={a.id} className={a.revoked_at ? 'opacity-50' : ''}>
                <td className={`${td} max-w-xs truncate`}>{label(a.item_version_id)}</td>
                <td className={td}>{actionLabel[a.action]}</td>
                <td className={td}>{a.reason}</td>
                <td className={td}>
                  {formatDateTime(a.created_at)}
                  {a.revoked_at && <Badge className="ml-1">dicabut</Badge>}
                </td>
                <td className={`${td} text-right`}>
                  {!a.revoked_at && (
                    <Button size="sm" variant="secondary" icon={<Undo2 className="h-3.5 w-3.5" />} onClick={() => setRevoking(a.id)}>
                      Cabut
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {list.data && <Pagination page={page} perPage={10} total={list.data.total} onPage={setPage} />}
      {creating && <AdjustmentForm exam={exam} onClose={() => setCreating(false)} />}
      <ConfirmDialog open={!!revoking} title="Cabut penyesuaian?" loading={revoke.isPending} onClose={() => setRevoking(null)} onConfirm={() => revoking && revoke.mutate(revoking)}>
        Nilai semua peserta yang terdampak dihitung ulang seperti semula.
      </ConfirmDialog>
    </div>
  );
}

function AdjustmentForm({ exam, onClose }: { exam: Exam; onClose: () => void }) {
  const items = exam.sections.flatMap((s) => s.items);
  const [versionId, setVersionId] = useState(items[0]?.version_id ?? '');
  const [action, setAction] = useState<AdjustmentAction>('annul_full_credit');
  const [reason, setReason] = useState('');
  const [key, setKey] = useState<string[]>([]);
  const [tf, setTf] = useState(true);
  const picked = items.find((i) => i.version_id === versionId);
  const item = useQuery({ queryKey: ['item', picked?.item_id], queryFn: () => itemApi.get(picked!.item_id), enabled: !!picked && action === 'override_key' });
  // the options of the pinned version are needed; the current version only matches when unchanged
  const sameVersion = item.data?.version.id === versionId;
  const answerKey = (): AnswerKey | undefined => {
    if (action !== 'override_key' || !picked) return undefined;
    if (picked.type === 'mcq_single') return { correct: key[0] };
    if (picked.type === 'mcq_multi') return { correct: key };
    if (picked.type === 'true_false') return { value: tf };
    return undefined;
  };
  const save = useAction(() => gradingApi.createAdjustment(exam.id, { item_version_id: versionId, action, reason, answer_key: answerKey() }), {
    success: (a) => `Penyesuaian diterapkan, ${a.regraded ?? 0} attempt dinilai ulang`,
    invalidate: [['adjustments']],
    toastErrors: false,
    onSuccess: onClose,
  });
  const keyable = picked && ['mcq_single', 'mcq_multi', 'true_false'].includes(picked.type);
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Penyesuaian soal"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button loading={save.isPending} disabled={!reason.trim() || (action === 'override_key' && !keyable)} onClick={() => save.mutate(undefined)}>
            Terapkan & nilai ulang
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Soal" error={save.fields.item_version_id} hint="Ujian blueprint acak: hanya soal yang dipilih manual yang tampil di sini.">
          <Select value={versionId} onChange={(e) => setVersionId(e.target.value)}>
            {items.map((i) => (
              <option key={i.version_id} value={i.version_id}>
                {i.code ?? '—'} · {labels.itemType[i.type]} · {i.stem_preview.slice(0, 80)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tindakan" error={save.fields.action}>
          <Select value={action} onChange={(e) => setAction(e.target.value as AdjustmentAction)}>
            {Object.entries(actionLabel).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
        {action === 'override_key' && (
          <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            {!keyable ? (
              <p className="text-xs text-slate-500">Ganti kunci hanya untuk pilihan ganda dan benar/salah.</p>
            ) : picked.type === 'true_false' ? (
              <Select value={String(tf)} onChange={(e) => setTf(e.target.value === 'true')}>
                <option value="true">Benar</option>
                <option value="false">Salah</option>
              </Select>
            ) : !item.data ? (
              <Loading />
            ) : !sameVersion ? (
              <Alert tone="amber">Soal di bank sudah berubah sejak ujian terbit; kunci versi lama tidak bisa dipilih dari sini.</Alert>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold">Kunci baru</p>
                {item.data.version.content.options?.map((o, i) => (
                  <label key={o.id} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2 text-xs dark:border-slate-700">
                    <input
                      type={picked.type === 'mcq_single' ? 'radio' : 'checkbox'}
                      name="key"
                      checked={key.includes(o.id)}
                      onChange={() => setKey(picked.type === 'mcq_single' ? [o.id] : key.includes(o.id) ? key.filter((k) => k !== o.id) : [...key, o.id])}
                    />
                    <span className="font-semibold">{String.fromCharCode(65 + i)}.</span>
                    <RichContent html={o.body} />
                  </label>
                ))}
              </div>
            )}
            {save.fields.answer_key && <p className="mt-1 text-[11px] text-rose-600">{save.fields.answer_key}</p>}
          </div>
        )}
        <Field label="Alasan" error={save.fields.reason} hint="Tercatat di audit log.">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="mis. Kunci salah ketik, jawaban benar adalah C." />
        </Field>
      </div>
    </Modal>
  );
}
