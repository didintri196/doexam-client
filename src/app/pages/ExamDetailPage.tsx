import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ArrowDown, ArrowLeft, ArrowUp, CheckCircle2, ClipboardCheck, Pencil, Plus, Rocket, Trash2, Undo2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Exam, Rule, Section } from '@/shared/api/types';
import { labels } from '@/shared/lib/format';
import { Alert, Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Field, IconButton, Input, Loading, Modal, PageHeader, Pagination, Select, Table, Tabs, td, th } from '@/shared/ui';
import { bankApi, examApi } from '../api';
import { RichEditor } from '../components/RichEditor';
import { useAction } from '../components/hooks';
import { SearchInput, useDebounced } from '../components/pickers';
import { Perm, useCan } from '../perm';
import { examTone } from './ExamsPage';
import { orderCompetencies, useCompetencies } from './SubjectsPage';

export function ExamDetailPage() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const can = useCan();
  const exam = useQuery({ queryKey: ['exam', id], queryFn: () => examApi.get(id) });
  const [tab, setTab] = useState<'structure' | 'settings'>('structure');
  const [check, setCheck] = useState<Awaited<ReturnType<typeof examApi.check>> | null>(null);
  const [confirm, setConfirm] = useState<'publish' | 'unpublish' | 'archive' | 'delete' | null>(null);
  const setExam = (e: Exam) => qc.setQueryData(['exam', id], e);
  const inv = [['exams']];

  const runCheck = useAction(() => examApi.check(id), { onSuccess: setCheck });
  const publish = useAction(() => examApi.publish(id), { success: 'Ujian diterbitkan', invalidate: inv, onSuccess: (e) => (setExam(e), setConfirm(null), setCheck(null)) });
  const unpublish = useAction(() => examApi.unpublish(id), { success: 'Ujian kembali menjadi draf', invalidate: inv, onSuccess: (e) => (setExam(e), setConfirm(null)) });
  const archive = useAction(() => examApi.archive(id), { success: 'Ujian diarsipkan', invalidate: inv, onSuccess: (e) => (setExam(e), setConfirm(null)) });
  const remove = useAction(() => examApi.remove(id), { success: 'Ujian dihapus', invalidate: inv, onSuccess: () => navigate('/exams') });

  if (exam.isLoading || !exam.data) return <Loading />;
  const e = exam.data;
  const draft = e.status === 'draft';
  const editable = draft && e.can_edit;

  return (
    <>
      <PageHeader
        title={e.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={examTone[e.status]}>{labels.examStatus[e.status]}</Badge>
            {e.mode === 'random_blueprint' && <Badge tone="blue">Blueprint acak</Badge>}
            <span>
              {e.item_count} soal per peserta · {e.total_minutes ? `${e.total_minutes} menit` : 'tanpa batas waktu'}
              {e.total_points !== null && ` · ${e.total_points} poin`}
            </span>
          </span>
        }
        back={
          <Link to="/exams" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Ujian
          </Link>
        }
        actions={
          <>
            {draft && (
              <Button variant="secondary" icon={<ClipboardCheck className="h-4 w-4" />} loading={runCheck.isPending} onClick={() => runCheck.mutate(undefined)}>
                Periksa
              </Button>
            )}
            {draft && can(Perm.ExamPublish) && (
              <Button variant="success" icon={<Rocket className="h-4 w-4" />} onClick={() => setConfirm('publish')}>
                Terbitkan
              </Button>
            )}
            {e.status === 'published' && can(Perm.ExamPublish) && (
              <>
                <Button variant="secondary" icon={<Undo2 className="h-4 w-4" />} onClick={() => setConfirm('unpublish')}>
                  Batal terbit
                </Button>
                <Button variant="secondary" icon={<Archive className="h-4 w-4" />} onClick={() => setConfirm('archive')}>
                  Arsipkan
                </Button>
              </>
            )}
            {editable && (
              <IconButton label="Hapus ujian" onClick={() => setConfirm('delete')}>
                <Trash2 className="h-4 w-4 text-rose-600" />
              </IconButton>
            )}
          </>
        }
      />

      {check && (
        <Alert tone={check.ready ? 'green' : 'amber'} className="mb-4">
          {check.ready ? (
            'Ujian siap diterbitkan.'
          ) : (
            <>
              <p className="font-semibold">Belum bisa diterbitkan:</p>
              <ul className="mt-1 list-disc pl-4">
                {check.problems.map((p, i) => (
                  <li key={i}>{p.message}</li>
                ))}
              </ul>
            </>
          )}
        </Alert>
      )}
      {!draft && (
        <Alert tone="blue" className="mb-4">
          Ujian sudah terbit: struktur dan soal terkunci. Judul, deskripsi, petunjuk, dan tampilan hasil masih bisa diubah.
        </Alert>
      )}

      <Tabs value={tab} onChange={setTab} items={[{ value: 'structure', label: 'Bagian & soal' }, { value: 'settings', label: 'Pengaturan' }]} />
      {tab === 'structure' ? <Structure exam={e} editable={editable} onExam={setExam} /> : <Settings exam={e} onExam={setExam} />}

      <ConfirmDialog open={confirm === 'publish'} title="Terbitkan ujian?" tone="success" confirmLabel="Terbitkan" loading={publish.isPending} onClose={() => setConfirm(null)} onConfirm={() => publish.mutate(undefined)}>
        Versi soal dipatok dan dikunci. Setelah terbit, ujian bisa dijadwalkan di sesi.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'unpublish'} title="Batalkan terbit?" loading={unpublish.isPending} onClose={() => setConfirm(null)} onConfirm={() => unpublish.mutate(undefined)}>
        Hanya bisa selama ujian belum punya sesi.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'archive'} title="Arsipkan ujian?" loading={archive.isPending} onClose={() => setConfirm(null)} onConfirm={() => archive.mutate(undefined)}>
        Ujian arsip tidak bisa dijadwalkan lagi; nilai dan laporan tetap ada.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'delete'} title="Hapus ujian?" tone="danger" confirmLabel="Hapus" loading={remove.isPending} onClose={() => setConfirm(null)} onConfirm={() => remove.mutate(undefined)}>
        Draf ujian dihapus beserta susunannya. Soal di bank tidak ikut terhapus.
      </ConfirmDialog>
    </>
  );
}

// ── settings ───────────────────────────────────────────────────
function Settings({ exam, onExam }: { exam: Exam; onExam: (e: Exam) => void }) {
  const toForm = (e: Exam) => ({
    title: e.title,
    description: e.description ?? '',
    instructions: e.instructions ?? '',
    duration: e.duration_minutes ? String(e.duration_minutes) : '',
    navigation: e.navigation,
    shuffle_items: e.shuffle_items,
    shuffle_options: e.shuffle_options,
    result_visibility: e.result_visibility,
    show_explanation: e.show_explanation,
    max_attempts: String(e.max_attempts),
    attempt_scoring: e.attempt_scoring,
    passing_score: e.passing_score === null ? '' : String(e.passing_score),
    negative_marking: String(e.negative_marking),
    profile: e.security.profile ?? 'standard',
  });
  const [f, setF] = useState(() => toForm(exam));
  useEffect(() => setF(toForm(exam)), [exam]);
  const draft = exam.status === 'draft';
  const save = useAction(
    () =>
      examApi.update(
        exam.id,
        draft
          ? {
              title: f.title,
              description: f.description,
              instructions: f.instructions,
              duration_minutes: f.duration ? Number(f.duration) : null,
              navigation: f.navigation,
              shuffle_items: f.shuffle_items,
              shuffle_options: f.shuffle_options,
              result_visibility: f.result_visibility,
              show_explanation: f.show_explanation,
              max_attempts: Number(f.max_attempts),
              attempt_scoring: f.attempt_scoring,
              passing_score: f.passing_score === '' ? null : Number(f.passing_score),
              negative_marking: Number(f.negative_marking || 0),
              security: { profile: f.profile },
            }
          : { title: f.title, description: f.description, instructions: f.instructions, result_visibility: f.result_visibility, show_explanation: f.show_explanation },
      ),
    { success: 'Pengaturan disimpan', invalidate: [['exams']], toastErrors: false, onSuccess: onExam },
  );
  const fe = save.fields;
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  return (
    <Card>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Judul" error={fe.title}>
            <Input value={f.title} onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Deskripsi singkat" error={fe.description}>
            <Input value={f.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
        </div>
        <Field label="Petunjuk untuk peserta" error={fe.instructions}>
          <RichEditor value={f.instructions} onChange={(v) => set('instructions', v)} />
        </Field>
        <fieldset disabled={!draft} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Durasi total (menit)" error={fe.duration_minutes} hint="Kosong = per bagian">
            <Input type="number" value={f.duration} onChange={(e) => set('duration', e.target.value)} />
          </Field>
          <Field label="Navigasi" error={fe.navigation}>
            <Select value={f.navigation} onChange={(e) => set('navigation', e.target.value as Exam['navigation'])}>
              <option value="free">Bebas bolak-balik</option>
              <option value="forward_only">Hanya maju</option>
            </Select>
          </Field>
          <Field label="KKM (0–100)" error={fe.passing_score}>
            <Input type="number" value={f.passing_score} onChange={(e) => set('passing_score', e.target.value)} />
          </Field>
          <Field label="Pengurangan salah (%)" error={fe.negative_marking}>
            <Input type="number" value={f.negative_marking} onChange={(e) => set('negative_marking', e.target.value)} />
          </Field>
          <Field label="Kesempatan mengerjakan" error={fe.max_attempts}>
            <Input type="number" min={1} max={20} value={f.max_attempts} onChange={(e) => set('max_attempts', e.target.value)} />
          </Field>
          <Field label="Nilai dari percobaan" error={fe.attempt_scoring}>
            <Select value={f.attempt_scoring} onChange={(e) => set('attempt_scoring', e.target.value as Exam['attempt_scoring'])}>
              <option value="highest">Tertinggi</option>
              <option value="latest">Terakhir</option>
              <option value="average">Rata-rata</option>
            </Select>
          </Field>
          <Field label="Profil keamanan" error={fe['security.profile']} hint="Standar: layar penuh, satu perangkat.">
            <Select value={f.profile} onChange={(e) => set('profile', e.target.value as 'light' | 'standard')}>
              <option value="standard">Standar</option>
              <option value="light">Ringan</option>
            </Select>
          </Field>
          <div className="space-y-2 pt-5">
            <Checkbox label="Acak urutan soal" checked={f.shuffle_items} onChange={(e) => set('shuffle_items', e.target.checked)} />
            <Checkbox label="Acak urutan pilihan" checked={f.shuffle_options} onChange={(e) => set('shuffle_options', e.target.checked)} />
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tampilkan hasil ke peserta" error={fe.result_visibility}>
            <Select value={f.result_visibility} onChange={(e) => set('result_visibility', e.target.value as Exam['result_visibility'])}>
              {Object.entries(labels.resultVisibility).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <div className="pt-6">
            <Checkbox label="Tampilkan pembahasan bersama hasil" checked={f.show_explanation} onChange={(e) => set('show_explanation', e.target.checked)} />
          </div>
        </div>
        {Object.keys(fe).length > 0 && <Alert>Periksa isian yang ditandai.</Alert>}
        <div className="flex justify-end">
          <Button loading={save.isPending} onClick={() => save.mutate(undefined)} disabled={!exam.can_edit}>
            Simpan pengaturan
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── structure ──────────────────────────────────────────────────
function Structure({ exam, editable, onExam }: { exam: Exam; editable: boolean; onExam: (e: Exam) => void }) {
  const [sectionForm, setSectionForm] = useState<Section | 'new' | null>(null);
  const sections = [...exam.sections].sort((a, b) => a.sort_order - b.sort_order);
  const move = useAction((ids: string[]) => examApi.orderSections(exam.id, ids), { onSuccess: onExam });
  const swap = (i: number, j: number) => {
    const ids = sections.map((s) => s.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    move.mutate(ids);
  };
  return (
    <div className="space-y-4">
      {sections.length === 0 && <EmptyState title="Belum ada bagian">Ujian terdiri dari satu atau beberapa bagian (mis. Pilihan Ganda, Esai).</EmptyState>}
      {sections.map((s, i) => (
        <SectionCard
          key={s.id}
          exam={exam}
          section={s}
          editable={editable}
          onExam={onExam}
          onEdit={() => setSectionForm(s)}
          onUp={i > 0 ? () => swap(i, i - 1) : undefined}
          onDown={i < sections.length - 1 ? () => swap(i, i + 1) : undefined}
        />
      ))}
      {editable && (
        <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setSectionForm('new')}>
          Tambah bagian
        </Button>
      )}
      {sectionForm && <SectionForm exam={exam} section={sectionForm === 'new' ? null : sectionForm} onExam={onExam} onClose={() => setSectionForm(null)} />}
    </div>
  );
}

function SectionCard({
  exam,
  section: s,
  editable,
  onExam,
  onEdit,
  onUp,
  onDown,
}: {
  exam: Exam;
  section: Section;
  editable: boolean;
  onExam: (e: Exam) => void;
  onEdit: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const [picker, setPicker] = useState(false);
  const [ruleForm, setRuleForm] = useState<Rule | 'new' | null>(null);
  const removeSection = useAction(() => examApi.removeSection(s.id), { success: 'Bagian dihapus', onSuccess: onExam });
  const removeItem = useAction((id: string) => examApi.removeSectionItem(id), { onSuccess: onExam });
  const removeRule = useAction((id: string) => examApi.removeRule(id), { onSuccess: onExam });
  const updatePoints = useAction((a: { id: string; points: number | null }) => examApi.updateSectionItem(a.id, { points: a.points }), { onSuccess: onExam });
  const order = useAction((ids: string[]) => examApi.orderItems(s.id, ids), { onSuccess: onExam });
  const items = [...s.items].sort((a, b) => a.sort_order - b.sort_order);
  const swap = (i: number, j: number) => {
    const ids = items.map((x) => x.id);
    [ids[i], ids[j]] = [ids[j], ids[i]];
    order.mutate(ids);
  };
  return (
    <Card
      title={
        <span className="flex flex-wrap items-center gap-2">
          {s.title}
          <Badge>{s.item_count} soal</Badge>
          {s.duration_minutes && <Badge tone="blue">{s.duration_minutes} menit</Badge>}
          {s.selection === 'random' && <Badge tone="blue">Acak dari aturan</Badge>}
          {!s.allow_revisit && <Badge tone="amber">Tidak bisa dibuka lagi</Badge>}
        </span>
      }
      actions={
        editable && (
          <>
            {onUp && (
              <IconButton label="Naikkan" onClick={onUp}>
                <ArrowUp className="h-3.5 w-3.5" />
              </IconButton>
            )}
            {onDown && (
              <IconButton label="Turunkan" onClick={onDown}>
                <ArrowDown className="h-3.5 w-3.5" />
              </IconButton>
            )}
            <IconButton label="Ubah bagian" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </IconButton>
            <IconButton label="Hapus bagian" onClick={() => removeSection.mutate(undefined)}>
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
            </IconButton>
          </>
        )
      }
    >
      {s.selection === 'fixed' ? (
        <div className="space-y-3">
          {items.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada soal di bagian ini.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr>
                    <th className={th}>#</th>
                    <th className={th}>Soal</th>
                    <th className={th}>Tipe</th>
                    <th className={th}>Poin</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.id}>
                      <td className={td}>{i + 1}</td>
                      <td className={td}>
                        <span className="font-mono text-[11px] text-slate-500">
                          {it.code ?? '—'} · v{it.version_no} {it.pinned && '· dipatok'}
                        </span>
                        <span className="line-clamp-2 block max-w-lg">{it.stem_preview}</span>
                      </td>
                      <td className={td}>{labels.itemType[it.type]}</td>
                      <td className={td}>
                        {editable ? (
                          <Input
                            type="number"
                            className="w-20"
                            defaultValue={it.points ?? ''}
                            placeholder={String(it.effective_points)}
                            onBlur={(e) => {
                              const v = e.target.value === '' ? null : Number(e.target.value);
                              if (v !== it.points) updatePoints.mutate({ id: it.id, points: v });
                            }}
                          />
                        ) : (
                          it.effective_points
                        )}
                      </td>
                      <td className={`${td} text-right`}>
                        {editable && (
                          <div className="flex justify-end gap-1">
                            <IconButton label="Naikkan" disabled={i === 0} onClick={() => swap(i, i - 1)}>
                              <ArrowUp className="h-3 w-3" />
                            </IconButton>
                            <IconButton label="Turunkan" disabled={i === items.length - 1} onClick={() => swap(i, i + 1)}>
                              <ArrowDown className="h-3 w-3" />
                            </IconButton>
                            <IconButton label="Keluarkan" onClick={() => removeItem.mutate(it.id)}>
                              <Trash2 className="h-3 w-3 text-rose-600" />
                            </IconButton>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {editable && (
            <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setPicker(true)}>
              Tambah soal dari bank
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {s.rules.length === 0 ? (
            <p className="text-xs text-slate-500">Belum ada aturan. Aturan menentukan berapa soal ditarik dari bank mana, per kompetensi/tipe/kesulitan.</p>
          ) : (
            <RuleTable exam={exam} rules={s.rules} editable={editable} onEdit={setRuleForm} onRemove={(id) => removeRule.mutate(id)} />
          )}
          {editable && (
            <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setRuleForm('new')}>
              Tambah aturan
            </Button>
          )}
        </div>
      )}
      {picker && <ItemPicker exam={exam} section={s} onExam={onExam} onClose={() => setPicker(false)} />}
      {ruleForm && <RuleForm section={s} rule={ruleForm === 'new' ? null : ruleForm} onExam={onExam} onClose={() => setRuleForm(null)} />}
    </Card>
  );
}

function RuleTable({ rules, editable, onEdit, onRemove }: { exam: Exam; rules: Rule[]; editable: boolean; onEdit: (r: Rule) => void; onRemove: (id: string) => void }) {
  const banks = useQuery({ queryKey: ['banks', 'all'], queryFn: () => bankApi.list({ per_page: 100 }) });
  const bankName = (id: string) => banks.data?.items.find((b) => b.id === id)?.name ?? '—';
  return (
    <Table>
      <thead>
        <tr>
          <th className={th}>Bank</th>
          <th className={th}>Filter</th>
          <th className={th}>Jumlah</th>
          <th className={th}>Tersedia</th>
          <th className={th}>Poin</th>
          <th className={th} />
        </tr>
      </thead>
      <tbody>
        {[...rules]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((r) => (
            <tr key={r.id}>
              <td className={td}>{bankName(r.bank_id)}</td>
              <td className={td}>
                <div className="flex flex-wrap gap-1">
                  {r.item_type && <Badge>{labels.itemType[r.item_type]}</Badge>}
                  {r.difficulty && <Badge>{labels.difficulty[r.difficulty]}</Badge>}
                  {r.competency_id && <Badge tone="blue">KD</Badge>}
                  {r.tags_any.map((t) => (
                    <Badge key={t} tone="blue">
                      #{t}
                    </Badge>
                  ))}
                </div>
              </td>
              <td className={td}>{r.item_count}</td>
              <td className={td}>
                <span className={r.available < r.item_count ? 'font-semibold text-rose-600' : ''}>{r.available}</span>
              </td>
              <td className={td}>{r.points ?? 'bawaan'}</td>
              <td className={`${td} text-right`}>
                {editable && (
                  <div className="flex justify-end gap-1">
                    <IconButton label="Ubah" onClick={() => onEdit(r)}>
                      <Pencil className="h-3 w-3" />
                    </IconButton>
                    <IconButton label="Hapus" onClick={() => onRemove(r.id)}>
                      <Trash2 className="h-3 w-3 text-rose-600" />
                    </IconButton>
                  </div>
                )}
              </td>
            </tr>
          ))}
      </tbody>
    </Table>
  );
}

function SectionForm({ exam, section, onExam, onClose }: { exam: Exam; section: Section | null; onExam: (e: Exam) => void; onClose: () => void }) {
  const [f, setF] = useState({
    title: section?.title ?? '',
    instructions: section?.instructions ?? '',
    duration: section?.duration_minutes ? String(section.duration_minutes) : '',
    selection: section?.selection ?? (exam.mode === 'random_blueprint' ? 'random' : 'fixed'),
    allow_revisit: section?.allow_revisit ?? true,
  });
  const body = {
    title: f.title,
    instructions: f.instructions,
    duration_minutes: f.duration ? Number(f.duration) : null,
    allow_revisit: f.allow_revisit,
    ...(section ? {} : { selection: f.selection }),
  };
  const save = useAction(() => (section ? examApi.updateSection(section.id, body) : examApi.createSection(exam.id, body)), {
    success: 'Bagian disimpan',
    toastErrors: false,
    onSuccess: (e) => {
      onExam(e);
      onClose();
    },
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={section ? 'Ubah bagian' : 'Bagian baru'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Judul" error={save.fields.title}>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Pilihan ganda" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Durasi (menit)" error={save.fields.duration_minutes} hint="Isi untuk timer per bagian (dikerjakan berurutan).">
            <Input type="number" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} />
          </Field>
          {!section && (
            <Field label="Pemilihan soal" error={save.fields.selection}>
              <Select value={f.selection} onChange={(e) => setF({ ...f, selection: e.target.value as 'fixed' | 'random' })}>
                <option value="fixed">Dipilih manual</option>
                {exam.mode === 'random_blueprint' && <option value="random">Acak dari aturan blueprint</option>}
              </Select>
            </Field>
          )}
        </div>
        <Checkbox label="Peserta boleh kembali ke bagian ini setelah selesai" checked={f.allow_revisit} onChange={(e) => setF({ ...f, allow_revisit: e.target.checked })} />
        <Field label="Petunjuk bagian" error={save.fields.instructions}>
          <RichEditor value={f.instructions} onChange={(v) => setF({ ...f, instructions: v })} />
        </Field>
      </div>
    </Modal>
  );
}

function BankSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const banks = useQuery({ queryKey: ['banks', 'all'], queryFn: () => bankApi.list({ per_page: 100 }) });
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>
        Pilih bank soal…
      </option>
      {banks.data?.items.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name} ({b.item_count})
        </option>
      ))}
    </Select>
  );
}

function ItemPicker({ exam, section, onExam, onClose }: { exam: Exam; section: Section; onExam: (e: Exam) => void; onClose: () => void }) {
  const [bankId, setBankId] = useState('');
  const [q, setQ] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const dq = useDebounced(q);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const used = new Set(exam.sections.flatMap((s) => s.items.map((i) => i.item_id)));
  const items = useQuery({
    queryKey: ['items', bankId, 'picker', dq, type, page],
    queryFn: () => bankApi.items(bankId, { q: dq, type, status: 'active', page, per_page: 20 }),
    enabled: !!bankId,
  });
  const add = useAction(() => examApi.addItems(section.id, [...picked].map((item_id) => ({ item_id }))), {
    success: () => `${picked.size} soal ditambahkan`,
    onSuccess: (e) => {
      onExam(e);
      onClose();
    },
  });
  const toggle = (id: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={`Tambah soal ke "${section.title}"`}
      footer={
        <>
          <span className="mr-auto self-center text-xs text-slate-500">{picked.size} dipilih</span>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button disabled={!picked.size} loading={add.isPending} onClick={() => add.mutate(undefined)}>
            Tambahkan
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <div className="w-64">
            <BankSelect value={bankId} onChange={(v) => (setBankId(v), setPage(1))} />
          </div>
          <SearchInput value={q} onChange={(v) => (setQ(v), setPage(1))} />
          <Select className="w-auto" value={type} onChange={(e) => (setType(e.target.value), setPage(1))}>
            <option value="">Semua tipe</option>
            {Object.entries(labels.itemType).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
        </div>
        <p className="text-[11px] text-slate-500">Hanya soal berstatus Aktif yang ditampilkan.</p>
        {!bankId ? (
          <EmptyState title="Pilih bank soal dulu" />
        ) : items.isLoading ? (
          <Loading />
        ) : !items.data?.items.length ? (
          <EmptyState title="Tidak ada soal aktif" />
        ) : (
          <>
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-700">
              {items.data.items.map((it) => {
                const inExam = used.has(it.id);
                return (
                  <label key={it.id} className={`flex cursor-pointer items-start gap-3 p-3 text-xs ${inExam ? 'opacity-40' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                    <input type="checkbox" className="mt-0.5 h-4 w-4 rounded" disabled={inExam} checked={picked.has(it.id)} onChange={() => toggle(it.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-[11px] text-slate-500">
                        {it.code ?? '—'} · {labels.itemType[it.type]} {it.difficulty && `· ${labels.difficulty[it.difficulty]}`} {inExam && '· sudah dipakai'}
                      </span>
                      <span className="line-clamp-2 block">{it.stem_preview}</span>
                    </span>
                    {picked.has(it.id) && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                  </label>
                );
              })}
            </div>
            <Pagination page={page} perPage={20} total={items.data.total} onPage={setPage} />
          </>
        )}
      </div>
    </Modal>
  );
}

function RuleForm({ section, rule, onExam, onClose }: { section: Section; rule: Rule | null; onExam: (e: Exam) => void; onClose: () => void }) {
  const [f, setF] = useState({
    bank_id: rule?.bank_id ?? '',
    competency_id: rule?.competency_id ?? '',
    item_type: rule?.item_type ?? '',
    difficulty: rule?.difficulty ?? '',
    tags: rule?.tags_any.join(', ') ?? '',
    item_count: String(rule?.item_count ?? 10),
    points: rule?.points === null || rule?.points === undefined ? '' : String(rule.points),
  });
  const bank = useQuery({ queryKey: ['banks', f.bank_id], queryFn: () => bankApi.get(f.bank_id), enabled: !!f.bank_id });
  const comps = useCompetencies(bank.data?.subject_id);
  const body = {
    bank_id: f.bank_id,
    competency_id: f.competency_id || null,
    item_type: f.item_type || null,
    difficulty: f.difficulty || null,
    tags_any: f.tags.split(',').map((t) => t.trim()).filter(Boolean),
    item_count: Number(f.item_count),
    points: f.points === '' ? null : Number(f.points),
  };
  const save = useAction(() => (rule ? examApi.updateRule(rule.id, body) : examApi.createRule(section.id, body)), {
    success: 'Aturan disimpan',
    toastErrors: false,
    onSuccess: (e) => {
      onExam(e);
      onClose();
    },
  });
  const fe = save.fields;
  return (
    <Modal
      open
      onClose={onClose}
      title={rule ? 'Ubah aturan' : 'Aturan blueprint'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Bank soal" error={fe.bank_id}>
          <BankSelect value={f.bank_id} onChange={(v) => setF({ ...f, bank_id: v, competency_id: '' })} />
        </Field>
        <Field label="Kompetensi" error={fe.competency_id}>
          <Select value={f.competency_id} onChange={(e) => setF({ ...f, competency_id: e.target.value })}>
            <option value="">Semua kompetensi</option>
            {orderCompetencies(comps.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipe soal" error={fe.item_type}>
            <Select value={f.item_type} onChange={(e) => setF({ ...f, item_type: e.target.value })}>
              <option value="">Semua tipe</option>
              {Object.entries(labels.itemType).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kesulitan" error={fe.difficulty}>
            <Select value={f.difficulty} onChange={(e) => setF({ ...f, difficulty: e.target.value })}>
              <option value="">Semua</option>
              {Object.entries(labels.difficulty).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Jumlah soal" error={fe.item_count}>
            <Input type="number" value={f.item_count} onChange={(e) => setF({ ...f, item_count: e.target.value })} />
          </Field>
          <Field label="Poin per soal" error={fe.points} hint="Kosong = poin bawaan soal">
            <Input type="number" value={f.points} onChange={(e) => setF({ ...f, points: e.target.value })} />
          </Field>
        </div>
        <Field label="Tag (salah satu)" error={fe.tags_any} hint="Pisahkan dengan koma.">
          <Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}
