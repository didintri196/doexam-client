import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileQuestion, FileText, FileUp, Lock, Pencil, Plus, Trash2, UserMinus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import type { Access, Bank, Stimulus, User } from '@/shared/api/types';
import { RichContent } from '@/shared/item/RichContent';
import { formatDateTime, labels } from '@/shared/lib/format';
import { Badge, Button, Card, ConfirmDialog, EmptyState, Field, IconButton, Input, Loading, Modal, PageHeader, Pagination, Select, Table, Tabs, td, Textarea, th } from '@/shared/ui';
import { bankApi } from '../api';
import { RichEditor } from '../components/RichEditor';
import { useAction, usePaging } from '../components/hooks';
import { SearchInput, SubjectSelect, useDebounced, UserPicker, useSubjects } from '../components/pickers';
import { orderCompetencies, useCompetencies } from './SubjectsPage';

const accessTone = { owner: 'blue', editor: 'blue', viewer: 'slate' } as const;

export function BanksPage() {
  const { page, setPage, filters, setFilter, query } = usePaging({ q: '', subject_id: '' });
  const q = useDebounced(filters.q);
  const list = useQuery({ queryKey: ['banks', { ...query, q }], queryFn: () => bankApi.list({ ...query, q }) });
  const subjects = useSubjects();
  const subjectName = (id: string) => subjects.data?.items.find((s) => s.id === id)?.name ?? '';
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Bank soal"
        subtitle="Kumpulan soal per subjek. Akses diatur per bank: pembaca, penyunting, pemilik."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
            Bank baru
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={filters.q} onChange={(v) => setFilter('q', v)} />
        <div className="w-56">
          <SubjectSelect value={filters.subject_id} onChange={(v) => setFilter('subject_id', v)} allowEmpty="Semua subjek" />
        </div>
      </div>
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.items.length ? (
        <EmptyState icon={<FileQuestion className="h-10 w-10" />} title="Belum ada bank soal" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.data.items.map((b) => (
              <Link key={b.id} to={`/banks/${b.id}`} className="rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{b.name}</p>
                  <Badge tone={accessTone[b.my_access]}>{labels.access[b.my_access]}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{subjectName(b.subject_id)}</p>
                {b.description && <p className="mt-2 line-clamp-2 text-xs text-slate-600 dark:text-slate-300">{b.description}</p>}
                <p className="mt-3 text-xs tabular-nums text-slate-500 dark:text-slate-400">{b.item_count} soal</p>
              </Link>
            ))}
          </div>
          <Pagination page={page} perPage={list.data.perPage} total={list.data.total} onPage={setPage} />
        </>
      )}
      {creating && <BankForm bank={null} onClose={() => setCreating(false)} />}
    </>
  );
}

function BankForm({ bank, onClose }: { bank: Bank | null; onClose: () => void }) {
  const navigate = useNavigate();
  const [f, setF] = useState({ subject_id: bank?.subject_id ?? '', name: bank?.name ?? '', description: bank?.description ?? '' });
  const save = useAction(
    () => (bank ? bankApi.update(bank.id, { name: f.name, description: f.description }) : bankApi.create({ ...f, description: f.description || undefined })),
    {
      success: 'Bank soal disimpan',
      invalidate: [['banks']],
      toastErrors: false,
      onSuccess: (b) => {
        onClose();
        if (!bank) navigate(`/banks/${b.id}`);
      },
    },
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={bank ? 'Ubah bank soal' : 'Bank soal baru'}
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
        {!bank && (
          <Field label="Subjek" error={save.fields.subject_id} hint={<Link to="/subjects" className="text-blue-600 hover:underline">Kelola subjek</Link>}>
            <SubjectSelect value={f.subject_id} onChange={(v) => setF({ ...f, subject_id: v })} invalid={!!save.fields.subject_id} />
          </Field>
        )}
        <Field label="Nama bank" error={save.fields.name}>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Matematika Dasar — Ujian Tengah" />
        </Field>
        <Field label="Deskripsi" error={save.fields.description}>
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
      </div>
    </Modal>
  );
}

export function BankDetailPage() {
  const { id = '' } = useParams();
  const bank = useQuery({ queryKey: ['banks', id], queryFn: () => bankApi.get(id) });
  const [tab, setTab] = useState<'items' | 'stimuli' | 'members'>('items');
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const remove = useAction(() => bankApi.remove(id), { success: 'Bank dihapus', invalidate: [['banks']], onSuccess: () => navigate('/banks') });
  if (bank.isLoading || !bank.data) return <Loading />;
  const b = bank.data;
  const canWrite = b.my_access !== 'viewer';
  const isOwner = b.my_access === 'owner';

  return (
    <>
      <PageHeader
        title={b.name}
        subtitle={b.description ?? undefined}
        back={
          <Link to="/banks" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> Bank soal
          </Link>
        }
        actions={
          <>
            <Badge tone={accessTone[b.my_access]}>Akses: {labels.access[b.my_access]}</Badge>
            {isOwner && (
              <>
                <IconButton label="Ubah bank" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" />
                </IconButton>
                <IconButton label="Hapus bank" onClick={() => setDeleting(true)}>
                  <Trash2 className="h-4 w-4 text-rose-600" />
                </IconButton>
              </>
            )}
            {canWrite && (
              <Button variant="secondary" icon={<FileUp className="h-4 w-4" />} onClick={() => navigate(`/banks/${id}/import-word`)}>
                Impor dari Word
              </Button>
            )}
            {canWrite && (
              <Button icon={<Plus className="h-4 w-4" />} onClick={() => navigate(`/banks/${id}/items/new`)}>
                Soal baru
              </Button>
            )}
          </>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'items', label: `Soal (${b.item_count})` },
          { value: 'stimuli', label: 'Stimulus / bacaan' },
          { value: 'members', label: 'Anggota' },
        ]}
      />
      {tab === 'items' && <ItemList bank={b} />}
      {tab === 'stimuli' && <StimulusList bank={b} canWrite={canWrite} />}
      {tab === 'members' && <BankMembers bank={b} isOwner={isOwner} />}
      {editing && <BankForm bank={b} onClose={() => setEditing(false)} />}
      <ConfirmDialog open={deleting} title="Hapus bank soal?" tone="danger" confirmLabel="Hapus" loading={remove.isPending} onClose={() => setDeleting(false)} onConfirm={() => remove.mutate(undefined)}>
        Bank hanya bisa dihapus bila sudah tidak berisi soal.
      </ConfirmDialog>
    </>
  );
}

function ItemList({ bank }: { bank: Bank }) {
  const { page, setPage, filters, setFilter, query } = usePaging({ q: '', type: '', status: '', difficulty: '', competency_id: '' });
  const q = useDebounced(filters.q);
  const list = useQuery({ queryKey: ['items', bank.id, { ...query, q }], queryFn: () => bankApi.items(bank.id, { ...query, q }) });
  const comps = useCompetencies(bank.subject_id);
  const compCode = (cid: string | null) => comps.data?.find((c) => c.id === cid)?.code;
  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={filters.q} onChange={(v) => setFilter('q', v)} placeholder="Cari isi soal…" />
        <Select className="w-auto" value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
          <option value="">Semua tipe</option>
          {Object.entries(labels.itemType).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select className="w-auto" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">Semua status</option>
          {Object.entries(labels.itemStatus).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select className="w-auto" value={filters.difficulty} onChange={(e) => setFilter('difficulty', e.target.value)}>
          <option value="">Semua tingkat</option>
          {Object.entries(labels.difficulty).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        <Select className="w-auto max-w-56" value={filters.competency_id} onChange={(e) => setFilter('competency_id', e.target.value)}>
          <option value="">Semua kompetensi</option>
          {orderCompetencies(comps.data ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} {c.name}
            </option>
          ))}
        </Select>
      </div>
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.items.length ? (
        <EmptyState icon={<FileQuestion className="h-10 w-10" />} title="Belum ada soal" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th className={th}>Soal</th>
                <th className={th}>Tipe</th>
                <th className={th}>KD</th>
                <th className={th}>Tingkat</th>
                <th className={th}>Status</th>
                <th className={th}>Diubah</th>
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className={td}>
                    <Link to={`/items/${it.id}`} className="block max-w-md">
                      <span className="font-mono text-[11px] text-slate-500">
                        {it.code ?? 'tanpa kode'} · v{it.version_no} {it.locked && <Lock className="inline h-3 w-3" />}
                      </span>
                      <span className="line-clamp-2 font-medium text-slate-900 hover:text-blue-600 dark:text-white">{it.stem_preview || '(kosong)'}</span>
                    </Link>
                  </td>
                  <td className={td}>{labels.itemType[it.type]}</td>
                  <td className={`${td} font-mono`}>{compCode(it.competency_id) ?? '—'}</td>
                  <td className={td}>{it.difficulty ? labels.difficulty[it.difficulty] : '—'}</td>
                  <td className={td}>
                    <Badge tone={it.status === 'active' ? 'green' : it.status === 'draft' ? 'amber' : 'slate'}>{labels.itemStatus[it.status]}</Badge>
                  </td>
                  <td className={td}>{formatDateTime(it.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} perPage={list.data.perPage} total={list.data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}

function StimulusList({ bank, canWrite }: { bank: Bank; canWrite: boolean }) {
  const [page, setPage] = useState(1);
  const list = useQuery({ queryKey: ['stimuli', bank.id, page], queryFn: () => bankApi.stimuli(bank.id, { page, per_page: 20 }) });
  const [editing, setEditing] = useState<Stimulus | 'new' | null>(null);
  const remove = useAction((s: Stimulus) => bankApi.removeStimulus(s.id), { success: 'Stimulus dihapus', invalidate: [['stimuli']] });
  return (
    <>
      {canWrite && (
        <div className="mb-4 flex justify-end">
          <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            Stimulus baru
          </Button>
        </div>
      )}
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.items.length ? (
        <EmptyState icon={<FileText className="h-10 w-10" />} title="Belum ada stimulus">
          Stimulus adalah bacaan, tabel, atau gambar yang dipakai beberapa soal sekaligus.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {list.data.items.map((s) => (
            <Card
              key={s.id}
              title={
                <span>
                  {s.title} <span className="font-mono text-[11px] font-normal text-slate-500">v{s.version_no}</span> {s.locked && <Lock className="inline h-3 w-3 text-slate-400" />}
                </span>
              }
              actions={
                canWrite && (
                  <>
                    <IconButton label="Ubah" onClick={() => setEditing(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </IconButton>
                    <IconButton label="Hapus" onClick={() => remove.mutate(s)}>
                      <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                    </IconButton>
                  </>
                )
              }
            >
              <RichContent html={s.body} className="line-clamp-4 text-xs text-slate-700 dark:text-slate-300" />
            </Card>
          ))}
          <Pagination page={page} perPage={20} total={list.data.total} onPage={setPage} />
        </div>
      )}
      {editing && <StimulusForm bankId={bank.id} stimulus={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function StimulusForm({ bankId, stimulus, onClose }: { bankId: string; stimulus: Stimulus | null; onClose: () => void }) {
  const [title, setTitle] = useState(stimulus?.title ?? '');
  const [body, setBody] = useState(stimulus?.body ?? '');
  const save = useAction(() => (stimulus ? bankApi.updateStimulus(stimulus.id, { title, body }) : bankApi.createStimulus(bankId, { title, body })), {
    success: 'Stimulus disimpan',
    invalidate: [['stimuli']],
    toastErrors: false,
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={stimulus ? 'Ubah stimulus' : 'Stimulus baru'}
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
        {stimulus?.locked && <p className="text-xs text-amber-600">Stimulus ini sudah dipakai ujian. Mengubah isinya membuat versi baru; ujian lama tetap memakai versi lama.</p>}
        <Field label="Judul" error={save.fields.title}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field group label="Isi" error={save.fields.body}>
          <RichEditor value={body} onChange={setBody} minHeight="min-h-48" />
        </Field>
      </div>
    </Modal>
  );
}

function BankMembers({ bank, isOwner }: { bank: Bank; isOwner: boolean }) {
  const list = useQuery({ queryKey: ['bank-members', bank.id], queryFn: () => bankApi.members(bank.id) });
  const [picked, setPicked] = useState<User[]>([]);
  const [access, setAccess] = useState<Access>('editor');
  const add = useAction(async () => {
    for (const u of picked) await bankApi.setMember(bank.id, u.id, access);
  }, { success: 'Anggota disimpan', invalidate: [['bank-members']], onSuccess: () => setPicked([]) });
  const change = useAction((a: { user: string; access: Access }) => bankApi.setMember(bank.id, a.user, a.access), { invalidate: [['bank-members']] });
  const remove = useAction((userId: string) => bankApi.removeMember(bank.id, userId), { invalidate: [['bank-members']] });
  return (
    <div className="space-y-4">
      {isOwner && (
        <Card title="Tambah anggota">
          <div className="space-y-2">
            <UserPicker selected={picked} onChange={setPicked} placeholder="Cari penyusun soal…" />
            {picked.length > 0 && (
              <div className="flex gap-2">
                <Select className="w-auto" value={access} onChange={(e) => setAccess(e.target.value as Access)}>
                  <option value="viewer">Pembaca</option>
                  <option value="editor">Penyunting</option>
                  <option value="owner">Pemilik</option>
                </Select>
                <Button loading={add.isPending} onClick={() => add.mutate(undefined)}>
                  Simpan
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.length ? (
        <EmptyState icon={<Users className="h-10 w-10" />} title="Belum ada anggota" />
      ) : (
        <Table>
          <tbody>
            {list.data.map((m) => (
              <tr key={m.user_id}>
                <td className={td}>
                  <p className="font-semibold">{m.full_name}</p>
                  <p className="font-mono text-[11px] text-slate-500">{m.username}</p>
                </td>
                <td className={td}>
                  {isOwner ? (
                    <Select className="w-auto" value={m.access} onChange={(e) => change.mutate({ user: m.user_id, access: e.target.value as Access })}>
                      <option value="viewer">Pembaca</option>
                      <option value="editor">Penyunting</option>
                      <option value="owner">Pemilik</option>
                    </Select>
                  ) : (
                    <Badge tone={accessTone[m.access]}>{labels.access[m.access]}</Badge>
                  )}
                </td>
                <td className={`${td} text-right`}>
                  {isOwner && (
                    <IconButton label="Keluarkan" onClick={() => remove.mutate(m.user_id)}>
                      <UserMinus className="h-3.5 w-3.5 text-rose-600" />
                    </IconButton>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
