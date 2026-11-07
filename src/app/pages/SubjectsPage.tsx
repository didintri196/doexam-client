import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BookOpenCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Competency, Subject } from '@/shared/api/types';
import { Button, Card, ConfirmDialog, cx, EmptyState, Field, IconButton, Input, Loading, Modal, PageHeader, Pagination, Select } from '@/shared/ui';
import { subjectApi } from '../api';
import { useAction } from '../components/hooks';
import { SearchInput, useDebounced, useLookup } from '../components/pickers';

export function useCompetencies(subjectId?: string) {
  return useQuery({ queryKey: ['competencies', subjectId], queryFn: () => subjectApi.competencies(subjectId!), enabled: !!subjectId, staleTime: 60_000 });
}

/** competencyLabel shows the code and name, indented by depth. */
export function orderCompetencies(list: Competency[]): (Competency & { depth: number })[] {
  const out: (Competency & { depth: number })[] = [];
  const walk = (parent: string | null, depth: number) => {
    list
      .filter((c) => c.parent_id === parent)
      .sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code))
      .forEach((c) => {
        out.push({ ...c, depth });
        walk(c.id, depth + 1);
      });
  };
  walk(null, 0);
  return out;
}

const SUBJECTS_PER_PAGE = 20;

export function SubjectsPage() {
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const [page, setPage] = useState(1);
  const subjects = useQuery({
    queryKey: ['subjects', 'page', dq, page],
    queryFn: () => subjectApi.list({ q: dq, page, per_page: SUBJECTS_PER_PAGE }),
    placeholderData: keepPreviousData,
  });
  const [selected, setSelected] = useState<string>('');
  // the chosen subject stays open while browsing other pages or searching
  const chosen = useLookup('subjects', [selected], subjectApi.get)(selected);
  const current = subjects.data?.items.find((s) => s.id === selected) ?? chosen ?? subjects.data?.items[0];
  useEffect(() => {
    if (subjects.data && subjects.data.items.length === 0 && page > 1) setPage(page - 1);
  }, [subjects.data, page]);
  const [editSubject, setEditSubject] = useState<Subject | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Subject | null>(null);
  const remove = useAction((s: Subject) => subjectApi.remove(s.id), { success: 'Subjek dihapus', invalidate: [['subjects']], onSuccess: () => setDeleting(null) });

  return (
    <>
      <PageHeader
        title="Subjek & kompetensi"
        subtitle="Mata pelajaran (atau bidang kompetensi) dan daftar KD/indikator untuk menandai soal."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditSubject('new')}>
            Tambah subjek
          </Button>
        }
      />
      {subjects.isLoading ? (
        <Loading />
      ) : !subjects.data?.total && !dq ? (
        <EmptyState icon={<BookOpenCheck className="h-10 w-10" />} title="Belum ada subjek">
          Buat subjek dulu sebelum membuat bank soal.
        </EmptyState>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Subjek">
            <div className="mb-3 [&>div]:w-full">
              <SearchInput
                value={q}
                onChange={(v) => {
                  setQ(v);
                  setPage(1);
                }}
                placeholder="Cari kode atau nama…"
              />
            </div>
            {subjects.data?.items.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">Tidak ada subjek yang cocok.</p>}
            <div className="space-y-1">
              {subjects.data?.items.map((s) => (
                <div
                  key={s.id}
                  className={cx(
                    'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs',
                    current?.id === s.id ? 'bg-blue-50 font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'hover:bg-slate-50 dark:hover:bg-slate-800',
                  )}
                >
                  <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => setSelected(s.id)}>
                    <span className="font-mono">{s.code}</span> · {s.name}
                  </button>
                  <div className="flex gap-1">
                    <IconButton label="Ubah" onClick={() => setEditSubject(s)}>
                      <Pencil className="h-3 w-3" />
                    </IconButton>
                    <IconButton label="Hapus" onClick={() => setDeleting(s)}>
                      <Trash2 className="h-3 w-3 text-rose-600" />
                    </IconButton>
                  </div>
                </div>
              ))}
            </div>
            {subjects.data && <Pagination page={page} perPage={SUBJECTS_PER_PAGE} total={subjects.data.total} onPage={setPage} />}
          </Card>
          <div className="lg:col-span-2">{current && <CompetencyList subject={current} />}</div>
        </div>
      )}
      {editSubject && <SubjectForm subject={editSubject === 'new' ? null : editSubject} onClose={() => setEditSubject(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Hapus subjek?"
        tone="danger"
        confirmLabel="Hapus"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      >
        Subjek <strong>{deleting?.name}</strong> hanya bisa dihapus bila tidak dipakai bank soal.
      </ConfirmDialog>
    </>
  );
}

function SubjectForm({ subject, onClose }: { subject: Subject | null; onClose: () => void }) {
  const [f, setF] = useState({ code: subject?.code ?? '', name: subject?.name ?? '' });
  const save = useAction(() => (subject ? subjectApi.update(subject.id, f) : subjectApi.create(f)), {
    success: 'Subjek disimpan',
    invalidate: [['subjects']],
    toastErrors: false,
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={subject ? 'Ubah subjek' : 'Tambah subjek'}
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
        <Field label="Kode" error={save.fields.code}>
          <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className="font-mono" placeholder="MTK" />
        </Field>
        <Field label="Nama" error={save.fields.name}>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Matematika" />
        </Field>
      </div>
    </Modal>
  );
}

function CompetencyList({ subject }: { subject: Subject }) {
  const list = useCompetencies(subject.id);
  const [editing, setEditing] = useState<Competency | 'new' | null>(null);
  const remove = useAction((c: Competency) => subjectApi.removeCompetency(c.id), { success: 'Kompetensi dihapus', invalidate: [['competencies']] });
  const ordered = orderCompetencies(list.data ?? []);
  return (
    <Card
      title={`Kompetensi — ${subject.name}`}
      actions={
        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setEditing('new')}>
          Tambah
        </Button>
      }
    >
      {list.isLoading ? (
        <Loading />
      ) : ordered.length === 0 ? (
        <EmptyState title="Belum ada kompetensi" />
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {ordered.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 py-2 text-xs" style={{ paddingLeft: c.depth * 20 }}>
              <span>
                <span className="font-mono font-semibold text-blue-700 dark:text-blue-300">{c.code}</span> {c.name}
              </span>
              <div className="flex gap-1">
                <IconButton label="Ubah" onClick={() => setEditing(c)}>
                  <Pencil className="h-3 w-3" />
                </IconButton>
                <IconButton label="Hapus" onClick={() => remove.mutate(c)}>
                  <Trash2 className="h-3 w-3 text-rose-600" />
                </IconButton>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && <CompetencyForm subject={subject} competency={editing === 'new' ? null : editing} all={list.data ?? []} onClose={() => setEditing(null)} />}
    </Card>
  );
}

function CompetencyForm({ subject, competency, all, onClose }: { subject: Subject; competency: Competency | null; all: Competency[]; onClose: () => void }) {
  const [f, setF] = useState({ code: competency?.code ?? '', name: competency?.name ?? '', parent_id: competency?.parent_id ?? '', sort_order: competency?.sort_order ?? 0 });
  const save = useAction(
    () =>
      competency
        ? subjectApi.updateCompetency(competency.id, { code: f.code, name: f.name, sort_order: f.sort_order })
        : subjectApi.createCompetency(subject.id, { code: f.code, name: f.name, sort_order: f.sort_order, parent_id: f.parent_id || null }),
    { success: 'Kompetensi disimpan', invalidate: [['competencies']], toastErrors: false, onSuccess: onClose },
  );
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title={competency ? 'Ubah kompetensi' : 'Tambah kompetensi'}
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
        <div className="grid grid-cols-3 gap-3">
          <Field label="Kode" error={save.fields.code} className="col-span-2">
            <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className="font-mono" placeholder="3.1" />
          </Field>
          <Field label="Urutan" error={save.fields.sort_order}>
            <Input type="number" value={f.sort_order} onChange={(e) => setF({ ...f, sort_order: Number(e.target.value) })} />
          </Field>
        </div>
        <Field label="Nama" error={save.fields.name}>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        {!competency && (
          <Field label="Induk" error={save.fields.parent_id}>
            <Select value={f.parent_id} onChange={(e) => setF({ ...f, parent_id: e.target.value })}>
              <option value="">— tingkat teratas —</option>
              {orderCompetencies(all).map((c) => (
                <option key={c.id} value={c.id}>
                  {'  '.repeat(c.depth)}
                  {c.code} {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Modal>
  );
}
