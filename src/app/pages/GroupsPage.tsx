import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, FileUp, Pencil, Plus, Trash2, UserMinus, UsersRound } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import type { AddMembersResult, Group, GroupKind } from '@/shared/api/types';
import { formatNumber, labels } from '@/shared/lib/format';
import { Badge, Button, ConfirmDialog, EmptyState, Field, IconButton, Input, Loading, Modal, PageHeader, Pagination, Select, Table, td, th } from '@/shared/ui';
import { groupApi } from '../api';
import { useAction, usePaging } from '../components/hooks';
import { BulkUserAdder, MAX_BULK, type PickedUser } from '../components/BulkUserAdder';
import { GroupPicker, SearchInput, useDebounced } from '../components/pickers';
import { Perm, useCan } from '../perm';
import { GroupPickerDialog } from './ImportPages';

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
  const [picking, setPicking] = useState(false);
  const navigate = useNavigate();
  const can = useCan();
  // importing participants creates accounts, so it also needs user.manage
  const canImport = can(Perm.UserManage);
  const remove = useAction((g: Group) => groupApi.remove(g.id), { success: 'Grup dihapus', invalidate: [['groups']], onSuccess: () => setDeleting(null) });

  return (
    <>
      <PageHeader
        title="Grup peserta"
        subtitle="Tingkat, kelompok, departemen, tim, atau angkatan. Peserta sesi bisa ditambahkan per grup."
        actions={
          <>
            {canImport && (
              <Button variant="secondary" icon={<FileUp className="h-4 w-4" />} onClick={() => setPicking(true)}>
                Impor peserta
              </Button>
            )}
            <Link to="/groups/import">
              <Button variant="ghost" icon={<FileSpreadsheet className="h-4 w-4" />}>
                Impor daftar grup
              </Button>
            </Link>
            <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
              Tambah grup
            </Button>
          </>
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
                      {canImport && (
                        <IconButton label="Impor peserta ke grup ini" onClick={() => navigate(`/groups/${g.id}/import`)}>
                          <FileUp className="h-3.5 w-3.5" />
                        </IconButton>
                      )}
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
      {picking && <GroupPickerDialog onClose={() => setPicking(false)} />}
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

/** addedMessage: "3 anggota baru, 2 sudah ada di grup". */
function addedMessage(r: AddMembersResult): string {
  const already = r.requested - r.added;
  if (r.added === 0) return already ? `Tidak ada anggota baru: ${formatNumber(already)} orang sudah ada di grup` : 'Tidak ada yang ditambahkan';
  return `${formatNumber(r.added)} anggota baru${already ? `, ${formatNumber(already)} sudah ada di grup` : ''}`;
}

function MembersModal({ group, onClose }: { group: Group; onClose: () => void }) {
  const [page, setPage] = useState(1);
  const list = useQuery({ queryKey: ['groups', group.id, 'members', page], queryFn: () => groupApi.members(group.id, { page, per_page: 20 }) });
  const [picked, setPicked] = useState<PickedUser[]>([]);
  const [sources, setSources] = useState<Group[]>([]);
  const [role, setRole] = useState<'member' | 'leader'>('member');
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState(false);

  const add = useAction(() => groupApi.addMembers(group.id, { user_ids: picked.map((u) => u.id), member_role: role }), {
    success: addedMessage,
    invalidate: [['groups']],
    onSuccess: () => setPicked([]),
  });
  const copy = useAction(
    async () => {
      const total = { requested: 0, added: 0 };
      for (const g of sources) {
        const r = await groupApi.addMembers(group.id, { from_group_id: g.id, member_role: role });
        total.requested += r.requested;
        total.added += r.added;
      }
      return total;
    },
    { success: addedMessage, invalidate: [['groups']], onSuccess: () => setSources([]) },
  );
  const removeOne = useAction((userId: string) => groupApi.removeMember(group.id, userId), { invalidate: [['groups']] });
  const removeMany = useAction(() => groupApi.removeMembers(group.id, [...checked]), {
    success: (r) => `${formatNumber(r.removed)} anggota dikeluarkan`,
    invalidate: [['groups']],
    onSuccess: () => {
      setChecked(new Set());
      setConfirmRemove(false);
    },
  });

  const rows = list.data?.items ?? [];
  const pageChecked = rows.length > 0 && rows.every((m) => checked.has(m.user_id));
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const togglePage = () =>
    setChecked((prev) => {
      const next = new Set(prev);
      rows.forEach((m) => (pageChecked ? next.delete(m.user_id) : next.add(m.user_id)));
      return next;
    });

  const roleSelect = (
    <Select className="w-auto" aria-label="Peran di grup" value={role} onChange={(e) => setRole(e.target.value as 'member' | 'leader')}>
      <option value="member">Sebagai anggota</option>
      <option value="leader">Sebagai pembina / ketua</option>
    </Select>
  );

  return (
    <Modal open onClose={onClose} size="lg" title={`Anggota ${group.name}`}>
      <div className="space-y-6">
        <section aria-label="Tambah anggota">
          <BulkUserAdder
            selected={picked}
            onChange={setPicked}
            importLink={`/groups/${group.id}/import`}
            action={
              <div className="flex flex-wrap items-center justify-end gap-2">
                {roleSelect}
                <Button loading={add.isPending} disabled={picked.length > MAX_BULK} onClick={() => add.mutate(undefined)}>
                  Tambahkan {formatNumber(picked.length)} orang
                </Button>
              </div>
            }
            extra={{
              label: 'Salin dari grup',
              content: (
                <div className="space-y-3">
                  <Field label="Grup sumber" hint="Semua anggota grup sumber ditambahkan. Yang sudah ada di grup ini tetap dengan perannya.">
                    <GroupPicker selected={sources} onChange={(gs) => setSources(gs.filter((g) => g.id !== group.id))} />
                  </Field>
                  {sources.length > 0 && (
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      {roleSelect}
                      <Button loading={copy.isPending} onClick={() => copy.mutate(undefined)}>
                        Salin dari {sources.length} grup
                      </Button>
                    </div>
                  )}
                  {copy.fields.from_group_id && <p className="text-xs text-rose-600">{copy.fields.from_group_id}</p>}
                </div>
              ),
            }}
          />
          {add.fields.user_ids && <p className="mt-2 text-xs text-rose-600">{add.fields.user_ids}</p>}
        </section>

        <section aria-label="Daftar anggota" className="space-y-2">
          <div className="flex min-h-8 items-center justify-between gap-3">
            <h3 className="text-xs font-semibold text-slate-800 dark:text-slate-100">
              Anggota <span className="font-normal tabular-nums text-slate-500">{formatNumber(list.data?.total ?? group.member_count)}</span>
            </h3>
            {checked.size > 0 && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>
                  Batal pilih
                </Button>
                <Button size="sm" variant="danger" icon={<UserMinus className="h-4 w-4" />} onClick={() => setConfirmRemove(true)}>
                  Keluarkan {formatNumber(checked.size)}
                </Button>
              </div>
            )}
          </div>
          {list.isLoading ? (
            <Loading />
          ) : !rows.length ? (
            <EmptyState title="Belum ada anggota">Tempel daftar username atau ID peserta di atas untuk menambah banyak sekaligus.</EmptyState>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <th className={`${th} w-10`}>
                      <input type="checkbox" className="h-4 w-4 rounded border-slate-300" aria-label="Pilih semua di halaman ini" checked={pageChecked} onChange={togglePage} />
                    </th>
                    <th className={th}>Nama</th>
                    <th className={th}>Peran</th>
                    <th className={th}>
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.user_id} className={checked.has(m.user_id) ? 'bg-blue-50/60 dark:bg-blue-950/30' : undefined}>
                      <td className={td}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300"
                          aria-label={`Pilih ${m.full_name}`}
                          checked={checked.has(m.user_id)}
                          onChange={() => toggle(m.user_id)}
                        />
                      </td>
                      <td className={td}>
                        <p className="font-semibold">{m.full_name}</p>
                        <p className="font-mono text-[11px] text-slate-500">
                          {m.username}
                          {m.external_id ? ` · ${m.external_id}` : ''}
                        </p>
                      </td>
                      <td className={td}>{m.member_role === 'leader' ? <Badge tone="blue">Pembina</Badge> : <Badge>Anggota</Badge>}</td>
                      <td className={`${td} text-right`}>
                        <IconButton label={`Keluarkan ${m.full_name}`} onClick={() => removeOne.mutate(m.user_id)}>
                          <UserMinus className="h-3.5 w-3.5 text-rose-600" />
                        </IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pagination page={page} perPage={20} total={list.data?.total ?? 0} onPage={setPage} />
            </>
          )}
        </section>
      </div>
      <ConfirmDialog
        open={confirmRemove}
        title={`Keluarkan ${formatNumber(checked.size)} anggota?`}
        confirmLabel="Keluarkan"
        tone="danger"
        loading={removeMany.isPending}
        onConfirm={() => removeMany.mutate(undefined)}
        onClose={() => setConfirmRemove(false)}
      >
        Mereka keluar dari {group.name}. Akun dan hasil ujian mereka tidak terhapus, dan bisa ditambahkan lagi kapan saja.
      </ConfirmDialog>
    </Modal>
  );
}
