import { useQuery } from '@tanstack/react-query';
import { Layers, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { ExamStatus } from '@/shared/api/types';
import { formatDateTime, labels } from '@/shared/lib/format';
import { Badge, Button, Checkbox, EmptyState, Field, Input, Loading, Modal, PageHeader, Pagination, Select, Table, td, th } from '@/shared/ui';
import { examApi, subjectApi } from '../api';
import { useAction, usePaging } from '../components/hooks';
import { SearchInput, SubjectSelect, useDebounced, useLookup } from '../components/pickers';
import { Perm, useCan } from '../perm';

export const examTone: Record<ExamStatus, 'amber' | 'green' | 'slate'> = { draft: 'amber', published: 'green', archived: 'slate' };

export function ExamsPage() {
  const can = useCan();
  const { page, setPage, filters, setFilter, query } = usePaging({ q: '', status: '', subject_id: '' });
  const [mine, setMine] = useState(false);
  const q = useDebounced(filters.q);
  const list = useQuery({ queryKey: ['exams', { ...query, q, mine }], queryFn: () => examApi.list({ ...query, q, mine: mine || undefined }) });
  const subject = useLookup('subjects', list.data?.items.map((e) => e.subject_id) ?? [], subjectApi.get);
  const subjectName = (id: string | null) => subject(id)?.name ?? '—';
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Ujian"
        subtitle="Susun bagian & soal, atur waktu dan aturan, lalu terbitkan agar bisa dijadwalkan."
        actions={
          can(Perm.ExamWrite) && (
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
              Ujian baru
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchInput value={filters.q} onChange={(v) => setFilter('q', v)} />
        <Select className="w-auto" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">Semua status</option>
          {Object.entries(labels.examStatus).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <div className="w-56">
          <SubjectSelect value={filters.subject_id} onChange={(v) => setFilter('subject_id', v)} allowEmpty="Semua subjek" />
        </div>
        <Checkbox label="Hanya buatan saya" checked={mine} onChange={(e) => setMine(e.target.checked)} />
      </div>
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.items.length ? (
        <EmptyState icon={<Layers className="h-10 w-10" />} title="Belum ada ujian" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th className={th}>Judul</th>
                <th className={th}>Subjek</th>
                <th className={th}>Durasi</th>
                <th className={th}>Bagian</th>
                <th className={th}>Status</th>
                <th className={th}>Diubah</th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className={td}>
                    <Link to={`/exams/${e.id}`} className="font-semibold text-slate-900 hover:text-blue-600 dark:text-white">
                      {e.title}
                    </Link>
                    {e.mode === 'random_blueprint' && <Badge className="ml-2" tone="blue">Blueprint acak</Badge>}
                  </td>
                  <td className={td}>{subjectName(e.subject_id)}</td>
                  <td className={td}>{e.duration_minutes ? `${e.duration_minutes} menit` : 'per bagian'}</td>
                  <td className={td}>{e.section_count}</td>
                  <td className={td}>
                    <Badge tone={examTone[e.status]}>{labels.examStatus[e.status]}</Badge>
                  </td>
                  <td className={td}>{formatDateTime(e.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} perPage={list.data.perPage} total={list.data.total} onPage={setPage} />
        </>
      )}
      {creating && <NewExam onClose={() => setCreating(false)} />}
    </>
  );
}

function NewExam({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [f, setF] = useState({ title: '', subject_id: '', mode: 'linear', duration: '90' });
  const save = useAction(
    () =>
      examApi.create({
        title: f.title,
        subject_id: f.subject_id || undefined,
        mode: f.mode,
        duration_minutes: f.duration ? Number(f.duration) : null,
      }),
    { success: 'Ujian dibuat', invalidate: [['exams']], toastErrors: false, onSuccess: (e) => navigate(`/exams/${e.id}`) },
  );
  return (
    <Modal
      open
      onClose={onClose}
      title="Ujian baru"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button loading={save.isPending} onClick={() => save.mutate(undefined)}>
            Buat & susun
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Judul" error={save.fields.title}>
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Ujian Tengah Matematika Dasar" />
        </Field>
        <Field label="Subjek" error={save.fields.subject_id}>
          <SubjectSelect value={f.subject_id} onChange={(v) => setF({ ...f, subject_id: v })} allowEmpty="— lintas subjek —" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Mode" error={save.fields.mode} hint="Blueprint acak: soal ditarik acak per peserta dari aturan.">
            <Select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}>
              <option value="linear">Linear (soal dipilih manual)</option>
              <option value="random_blueprint">Blueprint acak</option>
            </Select>
          </Field>
          <Field label="Durasi total (menit)" error={save.fields.duration_minutes} hint="Kosongkan bila durasi diatur per bagian.">
            <Input type="number" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}
