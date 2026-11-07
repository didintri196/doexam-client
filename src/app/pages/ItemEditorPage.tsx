import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, History, Lock, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { AcceptedAnswer, AnswerKey, Item, ItemStatus, ItemType, RubricCriterion } from '@/shared/api/types';
import { RichContent } from '@/shared/item/RichContent';
import { formatDateTime, labels } from '@/shared/lib/format';
import { Alert, Badge, Button, Card, Checkbox, ConfirmDialog, cx, Field, IconButton, Input, Loading, PageHeader, Select } from '@/shared/ui';
import { bankApi, itemApi, type ItemBody } from '../api';
import { RichEditor } from '../components/RichEditor';
import { StimulusSelect } from '../components/pickers';
import { useAction } from '../components/hooks';
import { orderCompetencies, useCompetencies } from './SubjectsPage';

interface Form {
  code: string;
  status: ItemStatus;
  type: ItemType;
  stem: string;
  options: { id: string; body: string }[];
  correct: string[];
  tf: boolean | null;
  input: 'text' | 'number';
  accepted: AcceptedAnswer[];
  maxWords: string;
  modelAnswer: string;
  rubric: RubricCriterion[];
  partial: boolean;
  explanation: string;
  points: string;
  difficulty: string;
  cognitive: string;
  tags: string;
  competency: string;
  stimulus: string;
}

const blank: Form = {
  code: '',
  status: 'draft',
  type: 'mcq_single',
  stem: '',
  options: ['a', 'b', 'c', 'd'].map((id) => ({ id, body: '' })),
  correct: [],
  tf: null,
  input: 'text',
  accepted: [{ value: '', match: 'case_insensitive' }],
  maxWords: '',
  modelAnswer: '',
  rubric: [],
  partial: false,
  explanation: '',
  points: '1',
  difficulty: '',
  cognitive: '',
  tags: '',
  competency: '',
  stimulus: '',
};

function fromItem(it: Item): Form {
  const v = it.version;
  const key = v.answer_key ?? {};
  return {
    code: it.code ?? '',
    status: it.status,
    type: v.type,
    stem: v.content.stem,
    options: v.content.options ?? blank.options,
    correct: Array.isArray(key.correct) ? key.correct : key.correct ? [key.correct] : [],
    tf: key.value ?? null,
    input: v.content.input ?? 'text',
    accepted: key.accepted?.length ? key.accepted : blank.accepted,
    maxWords: v.content.max_words ? String(v.content.max_words) : '',
    modelAnswer: key.model_answer ?? '',
    rubric: v.scoring.rubric ?? [],
    partial: v.scoring.method === 'partial',
    explanation: v.explanation ?? '',
    points: String(v.default_points),
    difficulty: v.difficulty ?? '',
    cognitive: v.cognitive_level ?? '',
    tags: v.tags.join(', '),
    competency: v.competency_id ?? '',
    stimulus: v.stimulus?.id ?? '',
  };
}

function toBody(f: Form): ItemBody {
  let key: AnswerKey | null = null;
  const content: ItemBody['content'] = { stem: f.stem };
  const scoring: ItemBody['scoring'] = {};
  switch (f.type) {
    case 'mcq_single':
      content.options = f.options;
      key = { correct: f.correct[0] ?? '' };
      break;
    case 'mcq_multi':
      content.options = f.options;
      key = { correct: f.correct };
      scoring.method = f.partial ? 'partial' : 'all_or_nothing';
      break;
    case 'true_false':
      key = f.tf === null ? null : { value: f.tf };
      break;
    case 'short_answer':
      content.input = f.input;
      key = {
        accepted: f.accepted
          .filter((a) => a.value.trim())
          .map((a) => ({ value: a.value, match: f.input === 'number' ? 'numeric' : a.match, ...(f.input === 'number' && a.tolerance ? { tolerance: Number(a.tolerance) } : {}) })),
      };
      break;
    case 'essay':
      if (f.maxWords) content.max_words = Number(f.maxWords);
      key = f.modelAnswer ? { model_answer: f.modelAnswer } : null;
      scoring.rubric = f.rubric.filter((r) => r.criterion.trim());
      break;
  }
  return {
    code: f.code,
    status: f.status,
    type: f.type,
    content,
    answer_key: key,
    scoring,
    explanation: f.explanation,
    default_points: Number(f.points || 1),
    difficulty: f.difficulty,
    cognitive_level: f.cognitive,
    tags: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
    competency_id: f.competency,
    stimulus_id: f.stimulus,
  };
}

const nextOptionId = (opts: { id: string }[]) => 'abcdefghij'.split('').find((c) => !opts.some((o) => o.id === c)) ?? `o${opts.length + 1}`;

/**
 * ItemEditorPage remounts the editor per item: going from an item to "Soal baru" (or to
 * another item) must not carry the previous form over.
 */
export function ItemEditorPage() {
  const { id, bankId } = useParams();
  return <ItemEditor key={id ?? `new:${bankId}`} />;
}

function ItemEditor() {
  const { id, bankId: bankParam } = useParams();
  const navigate = useNavigate();
  const item = useQuery({ queryKey: ['item', id], queryFn: () => itemApi.get(id!), enabled: !!id });
  const bankId = bankParam ?? item.data?.bank_id;
  const bank = useQuery({ queryKey: ['banks', bankId], queryFn: () => bankApi.get(bankId!), enabled: !!bankId });
  const comps = useCompetencies(bank.data?.subject_id);
  const versions = useQuery({ queryKey: ['item', id, 'versions'], queryFn: () => itemApi.versions(id!), enabled: !!id });
  const [f, setF] = useState<Form>(blank);
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    if (item.data) setF(fromItem(item.data));
  }, [item.data]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const save = useAction(async () => {
    if (id) return itemApi.update(id, toBody(f));
    // new items always start as draft; the chosen status is applied right after
    const { status, ...body } = toBody(f);
    const created = await itemApi.create(bankId!, body);
    return status && status !== 'draft' ? itemApi.update(created.id, { status }) : created;
  }, {
    success: (r) => (item.data && r.version.version_no !== item.data.version.version_no ? `Disimpan sebagai versi ${r.version.version_no}` : 'Soal disimpan'),
    invalidate: [['items'], ['item'], ['banks']],
    toastErrors: false,
    onSuccess: (r) => {
      if (!id) navigate(`/items/${r.id}`, { replace: true });
    },
  });
  const remove = useAction(() => itemApi.remove(id!), {
    success: 'Soal dihapus',
    invalidate: [['items'], ['banks']],
    onSuccess: () => navigate(`/banks/${bankId}`),
  });
  const fe = save.fields;
  const err = (prefix: string) => Object.entries(fe).find(([k]) => k.startsWith(prefix))?.[1];

  if ((id && item.isLoading) || !bank.data) return <Loading />;
  const readOnly = bank.data.my_access === 'viewer';
  const locked = item.data?.version.locked;
  const choice = f.type === 'mcq_single' || f.type === 'mcq_multi';

  const toggleCorrect = (oid: string) => {
    if (f.type === 'mcq_single') set('correct', [oid]);
    else set('correct', f.correct.includes(oid) ? f.correct.filter((c) => c !== oid) : [...f.correct, oid]);
  };

  return (
    <>
      <PageHeader
        title={id ? `Soal ${item.data?.code ?? ''}` : 'Soal baru'}
        subtitle={bank.data.name}
        back={
          <Link to={`/banks/${bankId}`} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> {bank.data.name}
          </Link>
        }
        actions={
          !readOnly && (
            <>
              {id && (
                <Button variant="secondary" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleting(true)}>
                  Hapus
                </Button>
              )}
              <Button icon={<Save className="h-4 w-4" />} loading={save.isPending} onClick={() => save.mutate(undefined)}>
                Simpan
              </Button>
            </>
          )
        }
      />
      {locked && (
        <Alert tone="blue" className="mb-4">
          <Lock className="mr-1 inline h-3.5 w-3.5" />
          Versi {item.data?.version.version_no} sudah dipakai ujian dan terkunci. Mengubah isi soal atau kunci membuat versi baru; ujian yang sudah terbit tetap memakai versi lama.
        </Alert>
      )}
      {Object.keys(fe).length > 0 && (
        <Alert className="mb-4">
          <p className="font-semibold">Soal belum valid:</p>
          <ul className="mt-1 list-disc pl-4">
            {Object.entries(fe).map(([k, v]) => (
              <li key={k}>
                <span className="font-mono">{k}</span>: {v}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Isi soal">
            <fieldset disabled={readOnly} className="space-y-4">
              <Field label="Tipe soal">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(labels.itemType) as ItemType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setF((x) => ({ ...x, type: t, correct: t === 'mcq_single' ? x.correct.slice(0, 1) : x.correct }))}
                      className={cx(
                        'rounded-lg border px-3 py-1.5 text-xs font-semibold',
                        f.type === t ? 'border-blue-600 bg-blue-600 text-accent-fg' : 'border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800',
                      )}
                    >
                      {labels.itemType[t]}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="Stimulus / bacaan (opsional)">
                {bankId && <StimulusSelect bankId={bankId} value={f.stimulus} onChange={(id) => set('stimulus', id)} emptyLabel="— tanpa stimulus —" />}
              </Field>
              <Field group label="Pertanyaan" error={err('content.stem')}>
                <RichEditor value={f.stem} onChange={(v) => set('stem', v)} placeholder="Tulis pertanyaan…" minHeight="min-h-32" invalid={!!err('content.stem')} />
              </Field>

              {choice && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Pilihan jawaban <span className="font-normal text-slate-500">— tandai {f.type === 'mcq_single' ? 'satu jawaban benar' : 'semua jawaban benar'}</span>
                  </p>
                  {f.options.map((o, i) => (
                    <div key={o.id} className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCorrect(o.id)}
                        title="Tandai sebagai jawaban benar"
                        className={cx(
                          'mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-xs font-semibold',
                          f.correct.includes(o.id) ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-300 text-slate-500 dark:border-slate-700',
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </button>
                      <div className="flex-1">
                        <RichEditor
                          value={o.body}
                          onChange={(v) => set('options', f.options.map((x) => (x.id === o.id ? { ...x, body: v } : x)))}
                          minHeight="min-h-10"
                          preview={false}
                          invalid={!!fe[`content.options[${i}].body`]}
                        />
                      </div>
                      <IconButton
                        label="Hapus pilihan"
                        className="mt-1"
                        disabled={f.options.length <= 2}
                        onClick={() => setF((x) => ({ ...x, options: x.options.filter((y) => y.id !== o.id), correct: x.correct.filter((c) => c !== o.id) }))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={f.options.length >= 10}
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => set('options', [...f.options, { id: nextOptionId(f.options), body: '' }])}
                    >
                      Tambah pilihan
                    </Button>
                    {f.type === 'mcq_multi' && <Checkbox label="Nilai parsial (sebagian benar dapat sebagian poin)" checked={f.partial} onChange={(e) => set('partial', e.target.checked)} />}
                  </div>
                </div>
              )}

              {f.type === 'true_false' && (
                <Field label="Kunci" error={err('answer_key')}>
                  <div className="grid grid-cols-2 gap-2">
                    {[true, false].map((v) => (
                      <button
                        key={String(v)}
                        type="button"
                        onClick={() => set('tf', v)}
                        className={cx('rounded-xl border py-3 text-sm font-semibold', f.tf === v ? (v ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-rose-600 bg-rose-600 text-white') : 'border-slate-200 dark:border-slate-700')}
                      >
                        {v ? 'Benar' : 'Salah'}
                      </button>
                    ))}
                  </div>
                </Field>
              )}

              {f.type === 'short_answer' && (
                <div className="space-y-3">
                  <Field label="Jenis jawaban">
                    <Select value={f.input} onChange={(e) => set('input', e.target.value as 'text' | 'number')}>
                      <option value="text">Teks</option>
                      <option value="number">Angka (koma desimal diterima)</option>
                    </Select>
                  </Field>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Jawaban yang diterima</p>
                  {f.accepted.map((a, i) => (
                    <div key={i} className="flex gap-2">
                      <Input value={a.value} onChange={(e) => set('accepted', f.accepted.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} invalid={!!fe[`answer_key.accepted[${i}].value`]} />
                      {f.input === 'text' ? (
                        <Select className="w-44" value={a.match ?? 'case_insensitive'} onChange={(e) => set('accepted', f.accepted.map((x, j) => (j === i ? { ...x, match: e.target.value as AcceptedAnswer['match'] } : x)))}>
                          <option value="case_insensitive">Abaikan huruf besar</option>
                          <option value="exact">Persis sama</option>
                        </Select>
                      ) : (
                        <Input
                          className="w-32"
                          type="number"
                          step="any"
                          placeholder="Toleransi ±"
                          value={a.tolerance ?? ''}
                          onChange={(e) => set('accepted', f.accepted.map((x, j) => (j === i ? { ...x, tolerance: e.target.value ? Number(e.target.value) : null } : x)))}
                        />
                      )}
                      <IconButton label="Hapus" disabled={f.accepted.length <= 1} onClick={() => set('accepted', f.accepted.filter((_, j) => j !== i))}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  ))}
                  <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => set('accepted', [...f.accepted, { value: '', match: 'case_insensitive' }])}>
                    Tambah jawaban
                  </Button>
                </div>
              )}

              {f.type === 'essay' && (
                <div className="space-y-4">
                  <Field label="Batas kata (opsional)" error={fe['content.max_words']}>
                    <Input type="number" value={f.maxWords} onChange={(e) => set('maxWords', e.target.value)} className="w-40" />
                  </Field>
                  <Field group label="Jawaban model (untuk korektor)">
                    <RichEditor value={f.modelAnswer} onChange={(v) => set('modelAnswer', v)} />
                  </Field>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Rubrik (opsional)</p>
                    {f.rubric.map((r, i) => (
                      <div key={i} className="flex gap-2">
                        <Input placeholder="Kriteria" value={r.criterion} onChange={(e) => set('rubric', f.rubric.map((x, j) => (j === i ? { ...x, criterion: e.target.value } : x)))} />
                        <Input className="w-24" type="number" placeholder="Maks" value={r.max} onChange={(e) => set('rubric', f.rubric.map((x, j) => (j === i ? { ...x, max: Number(e.target.value) } : x)))} />
                        <IconButton label="Hapus" onClick={() => set('rubric', f.rubric.filter((_, j) => j !== i))}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </IconButton>
                      </div>
                    ))}
                    <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => set('rubric', [...f.rubric, { criterion: '', max: 1 }])}>
                      Tambah kriteria
                    </Button>
                  </div>
                </div>
              )}

              <Field group label="Pembahasan (opsional)">
                <RichEditor value={f.explanation} onChange={(v) => set('explanation', v)} />
              </Field>
            </fieldset>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Metadata">
            <fieldset disabled={readOnly} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kode" error={fe.code}>
                  <Input value={f.code} onChange={(e) => set('code', e.target.value)} className="font-mono" />
                </Field>
                <Field label="Poin bawaan" error={fe.default_points}>
                  <Input type="number" step="0.5" value={f.points} onChange={(e) => set('points', e.target.value)} />
                </Field>
              </div>
              <Field label="Status" hint="Hanya soal aktif yang bisa dipakai ujian.">
                <Select value={f.status} onChange={(e) => set('status', e.target.value as ItemStatus)}>
                  {Object.entries(labels.itemStatus).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Kompetensi / KD" error={fe.competency_id}>
                <Select value={f.competency} onChange={(e) => set('competency', e.target.value)}>
                  <option value="">—</option>
                  {orderCompetencies(comps.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {'  '.repeat(c.depth)}
                      {c.code} {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tingkat kesulitan" error={fe.difficulty}>
                  <Select value={f.difficulty} onChange={(e) => set('difficulty', e.target.value)}>
                    <option value="">—</option>
                    {Object.entries(labels.difficulty).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Level kognitif" error={fe.cognitive_level}>
                  <Input value={f.cognitive} onChange={(e) => set('cognitive', e.target.value)} placeholder="C3 / HOTS" />
                </Field>
              </div>
              <Field label="Tag" hint="Pisahkan dengan koma." error={fe.tags}>
                <Input value={f.tags} onChange={(e) => set('tags', e.target.value)} />
              </Field>
            </fieldset>
          </Card>

          <Card title="Pratinjau peserta">
            <div className="space-y-3 text-sm">
              <RichContent html={f.stem || '<p>(pertanyaan kosong)</p>'} />
              {choice && (
                <ol className="space-y-1.5">
                  {f.options.map((o, i) => (
                    <li key={o.id} className={cx('flex gap-2 rounded-lg border p-2 text-xs', f.correct.includes(o.id) ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30' : 'border-slate-200 dark:border-slate-700')}>
                      <span className="font-semibold">{String.fromCharCode(65 + i)}.</span>
                      <RichContent html={o.body} />
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </Card>

          {id && versions.data && (
            <Card title={<span className="flex items-center gap-1.5"><History className="h-4 w-4" /> Riwayat versi</span>}>
              <ul className="space-y-1.5 text-xs">
                {versions.data.map((v) => (
                  <li key={v.id} className="flex items-center justify-between">
                    <span>
                      v{v.version_no} · {labels.itemType[v.type]} {v.current && <Badge tone="blue">aktif</Badge>}
                    </span>
                    <span className="flex items-center gap-1 text-slate-500">
                      {v.locked && <Lock className="h-3 w-3" />} {formatDateTime(v.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      <ConfirmDialog open={deleting} title="Hapus soal?" tone="danger" confirmLabel="Hapus" loading={remove.isPending} onClose={() => setDeleting(false)} onConfirm={() => remove.mutate(undefined)}>
        Soal yang sudah dipakai ujian tidak bisa dihapus; pensiunkan saja (status Pensiun).
      </ConfirmDialog>
    </>
  );
}
