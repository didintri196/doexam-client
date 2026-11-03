import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, UserMinus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import type { Group, GroupKind, User } from '@/shared/api/types';
import { labels } from '@/shared/lib/format';
import { Badge, Button, ConfirmDialog, EmptyState, Field, IconButton, Input, Loading, Modal, PageHeader, Pagination, Select, Table, td, th } from '@/shared/ui';
import { groupApi } from '../api';
import { useAction, usePaging } from '../components/hooks';
import { SearchInput, useDebounced, UserPicker } from '../components/pickers';

const kinds = Object.keys(labels.groupKind) as GroupKind[];

export function GroupsPage() {
  const { page, setPage, filters, setFilter, query } = usePaging({ q: '', kind: '' });
  const q = useDebounced(filters.q);
  const list = useQuery({ queryKey: ['groups', { ...query, q }], queryFn: () => groupApi.list({ ...query, q }) });
  const all = useQuery({ queryKey: ['groups', 'all'], queryFn: () => groupApi.list({ per_page: 100 }) });
  const nameOf = (id: string | null) => (id ? all.data?.items.find((g) => g.id === id)?.name ?? '—' : '—');
  const [editing, setEditing] = useState<Group | 'new' | null>(null);
  const [members, setMembers] = useState<Group | null>(null);
  const [deleting, setDeleting] = useState<Group | null>(null);
  const remove = useAction((g: Group) => groupApi.remove(g.id), { success: 'Grup dihapus', invalidate: [['groups']], onSuccess: () => setDeleting(null) });

  return (
    <>
      <PageHeader
        title="Kelas & grup"
        subtitle="Tingkat, kelas, divisi, atau angkatan. Peserta sesi bisa ditambahkan per grup."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            Tambah grup
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={filters.q} onChange={(v) => setFilter('q', v)} />
        <Select className="w-auto" value={filters.kind} onChange={(e) => setFilter('kind', e.target.value)}>
          <option value="">Semua jenis</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {labels.groupKind[k]}
            </option>
          ))}
        </Select>
      </div>
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.items.length ? (
        <EmptyState icon={<UsersRound className="h-10 w-10" />} title="Belum ada grup" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th className={th}>Nama</th>
                <th className={th}>Jenis</th>
                <th className={th}>Induk</th>
                <th className={th}>Periode</th>
                <th className={th}>Anggota</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((g) => (
                <tr key={g.id}>
                  <td className={td}>
                    <p className="font-semibold text-slate-900 dark:text-white">{g.name}</p>
                    {g.code && <p className="font-mono text-[11px] text-slate-500">{g.code}</p>}
                  </td>
                  <td className={td}>
                    <Badge>{labels.groupKind[g.kind]}</Badge>
                  </td>
                  <td className={td}>{nameOf(g.parent_id)}</td>
                  <td className={td}>{g.period ?? '—'}</td>
                  <td className={td}>
                    <button type="button" className="font-medium text-blue-700 hover:underline dark:text-blue-300" onClick={() => setMembers(g)}>
                      {g.member_count} anggota
                    </button>
                  </td>
                  <td className={`${td} text-right`}>
                    <div className="flex justify-end gap-1">
                      <IconButton label="Ubah" onClick={() => setEditing(g)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton label="Hapus" onClick={() => setDeleting(g)}>
                        <Trash2 className="h-3.5 w-3.5 text-rose-600" />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} perPage={list.data.perPage} total={list.data.total} onPage={setPage} />
        </>
      )}
      {editing && <GroupForm group={editing === 'new' ? null : editing} groups={all.data?.items ?? []} onClose={() => setEditing(null)} />}
      {members && <MembersModal group={members} onClose={() => setMembers(null)} />}
      <ConfirmDialog
        open={!!deleting}
        title="Hapus grup?"
        tone="danger"
        confirmLabel="Hapus"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting)}
      >
        Grup <strong>{deleting?.name}</strong> dihapus. Akun anggotanya tidak ikut terhapus.
      </ConfirmDialog>
    </>
  );
}

function GroupForm({ group, groups, onClose }: { group: Group | null; groups: Group[]; onClose: () => void }) {
  const [f, setF] = useState({
    name: group?.name ?? '',
    kind: group?.kind ?? ('class' as GroupKind),
    code: group?.code ?? '',
    period: group?.period ?? '',
    parent_id: group?.parent_id ?? '',
  });
  const save = useAction(
    () =>
      group
        ? groupApi.update(group.id, { ...f, parent_id: f.parent_id })
        : groupApi.create({ name: f.name, kind: f.kind, code: f.code || undefined, period: f.period || undefined, parent_id: f.parent_id || null }),
    { success: 'Grup disimpan', invalidate: [['groups']], toastErrors: false, onSuccess: onClose },
  );
  const fe = save.fields;
  return (
    <Modal
      open
      onClose={onClose}
      title={group ? 'Ubah grup' : 'Tambah grup'}
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
        <Field label="Nama" error={fe.name}>
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="X IPA 1" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Jenis" error={fe.kind}>
            <Select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as GroupKind })}>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {labels.groupKind[k]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Kode" error={fe.code}>
            <Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className="font-mono" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Induk" error={fe.parent_id}>
            <Select value={f.parent_id} onChange={(e) => setF({ ...f, parent_id: e.target.value })}>
              <option value="">— tanpa induk —</option>
              {groups
                .filter((g) => g.id !== group?.id)
                .map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Periode" error={fe.period} hint="mis. 2026/2027">
            <Input value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function MembersModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const list = useQuery({ queryKey: ['groups', group.id, 'members', page], queryFn: () => groupApi.members(group.id, { page, per_page: 20 }) });
  const [picked, setPicked] = useState<User[]>([]);
  const [role, setRole] = useState<'member' | 'leader'>('member');
  const add = useAction(() => groupApi.addMembers(group.id, picked.map((u) => u.id), role), {
    success: 'Anggota ditambahkan',
    invalidate: [['groups']],
    onSuccess: () => setPicked([]),
  });
  const remove = useAction((userId: string) => groupApi.removeMember(group.id, userId), { invalidate: [['groups']] });
  return (
    <Modal open onClose={onClose} size="lg" title={`Anggota ${group.name}`}>
      <div className="space-y-4">
        <div className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <UserPicker selected={picked} onChange={setPicked} />
          {picked.length > 0 && (
            <div className="flex items-center gap-2">
              <Select className="w-auto" value={role} onChange={(e) => setRole(e.target.value as 'member' | 'leader')}>
                <option value="member">Anggota</option>
                <option value="leader">Wali / ketua</option>
              </Select>
              <Button loading={add.isPending} onClick={() => add.mutate(undefined)}>
                Tambahkan {picked.length}
              </Button>
            </div>
          )}
        </div>
        {list.isLoading ? (
          <Loading />
        ) : !list.data?.items.length ? (
          <EmptyState title="Belum ada anggota" />
        ) : (
          <>
            <Table>
              <tbody>
                {list.data.items.map((m) => (
                  <tr key={m.user_id}>
                    <td className={td}>
                      <p className="font-semibold">{m.full_name}</p>
                      <p className="font-mono text-[11px] text-slate-500">{m.username}</p>
                    </td>
                    <td className={td}>{m.member_role === 'leader' ? <Badge tone="blue">Wali</Badge> : <Badge>Anggota</Badge>}</td>
                    <td className={`${td} text-right`}>
                      <IconButton label="Keluarkan" onClick={() => remove.mutate(m.user_id)}>
                        <UserMinus className="h-3.5 w-3.5 text-rose-600" />
                      </IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination page={page} perPage={20} total={list.data.total} onPage={setPage} />
          </>
        )}
      </div>
    </Modal>
  );
}
