import { useQuery } from '@tanstack/react-query';
import { Copy, KeyRound, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import type { Role, User, UserStatus } from '@/shared/api/types';
import { formatDateTime } from '@/shared/lib/format';
import { Alert, Badge, Button, Checkbox, ConfirmDialog, EmptyState, Field, IconButton, Input, Loading, Modal, PageHeader, Pagination, Select, Table, td, th, useToast } from '@/shared/ui';
import { userApi } from '../api';
import { useAction, usePaging } from '../components/hooks';
import { SearchInput, useDebounced } from '../components/pickers';

export function useRoles() {
  return useQuery({ queryKey: ['roles'], queryFn: userApi.roles, staleTime: 5 * 60_000 });
}

export function UsersPage() {
  const { page, setPage, filters, setFilter, query } = usePaging({ q: '', role: '', status: '' });
  const q = useDebounced(filters.q);
  const list = useQuery({ queryKey: ['users', { ...query, q }], queryFn: () => userApi.list({ ...query, q }) });
  const roles = useRoles();
  const roleName = (code: string) => roles.data?.find((r) => r.code === code)?.name ?? code;
  const [editing, setEditing] = useState<User | 'new' | null>(null);
  const [password, setPassword] = useState<{ user: string; password: string } | null>(null);
  const [confirm, setConfirm] = useState<{ kind: 'delete' | 'reset'; user: User } | null>(null);

  const reset = useAction((u: User) => userApi.resetPassword(u.id), {
    onSuccess: (r, u) => {
      setConfirm(null);
      setPassword({ user: u.username, password: r.temporary_password });
    },
  });
  const remove = useAction((u: User) => userApi.remove(u.id), { success: 'Pengguna dihapus', invalidate: [['users']], onSuccess: () => setConfirm(null) });

  return (
    <>
      <PageHeader
        title="Pengguna"
        subtitle="Akun siswa, guru, pengawas, dan admin."
        actions={
          <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditing('new')}>
            Tambah pengguna
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <SearchInput value={filters.q} onChange={(v) => setFilter('q', v)} placeholder="Cari nama, username, NIS…" />
        <Select className="w-auto" value={filters.role} onChange={(e) => setFilter('role', e.target.value)}>
          <option value="">Semua peran</option>
          {roles.data?.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </Select>
        <Select className="w-auto" value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
          <option value="">Semua status</option>
          <option value="active">Aktif</option>
          <option value="suspended">Nonaktif</option>
        </Select>
      </div>
      {list.isLoading ? (
        <Loading />
      ) : !list.data?.items.length ? (
        <EmptyState icon={<Users className="h-10 w-10" />} title="Belum ada pengguna" />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th className={th}>Nama</th>
                <th className={th}>Peran</th>
                <th className={th}>Status</th>
                <th className={th}>Login terakhir</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {list.data.items.map((u) => (
                <tr key={u.id}>
                  <td className={td}>
                    <p className="font-semibold text-slate-900 dark:text-white">{u.full_name}</p>
                    <p className="font-mono text-[11px] text-slate-500">
                      {u.username}
                      {u.external_id && ` · ${u.external_id}`}
                    </p>
                  </td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} tone={r === 'admin' ? 'purple' : r === 'participant' ? 'slate' : 'blue'}>
                          {roleName(r)}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className={td}>
                    <Badge tone={u.status === 'active' ? 'green' : 'red'}>{u.status === 'active' ? 'Aktif' : 'Nonaktif'}</Badge>
                    {u.must_change_password && (
                      <Badge tone="amber" className="ml-1">
                        Password sementara
                      </Badge>
                    )}
                  </td>
                  <td className={td}>{formatDateTime(u.last_login_at)}</td>
                  <td className={`${td} text-right`}>
                    <div className="flex justify-end gap-1">
                      <IconButton label="Ubah" onClick={() => setEditing(u)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton label="Reset password" onClick={() => setConfirm({ kind: 'reset', user: u })}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton label="Hapus" onClick={() => setConfirm({ kind: 'delete', user: u })}>
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

      {editing && (
        <UserForm
          user={editing === 'new' ? null : editing}
          roles={roles.data ?? []}
          onClose={() => setEditing(null)}
          onCreated={(username, pw) => pw && setPassword({ user: username, password: pw })}
        />
      )}
      {password && <PasswordModal {...password} onClose={() => setPassword(null)} />}
      <ConfirmDialog
        open={confirm?.kind === 'reset'}
        title="Reset password?"
        onClose={() => setConfirm(null)}
        loading={reset.isPending}
        onConfirm={() => confirm && reset.mutate(confirm.user)}
      >
        Password <strong>{confirm?.user.full_name}</strong> diganti password sementara dan semua sesi loginnya dicabut.
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.kind === 'delete'}
        title="Hapus pengguna?"
        tone="danger"
        confirmLabel="Hapus"
        onClose={() => setConfirm(null)}
        loading={remove.isPending}
        onConfirm={() => confirm && remove.mutate(confirm.user)}
      >
        <strong>{confirm?.user.full_name}</strong> tidak bisa login lagi. Riwayat ujiannya tetap tersimpan.
      </ConfirmDialog>
    </>
  );
}

function UserForm({ user, roles, onClose, onCreated }: { user: User | null; roles: Role[]; onClose: () => void; onCreated: (username: string, password?: string) => void }) {
  const [f, setF] = useState({
    username: user?.username ?? '',
    full_name: user?.full_name ?? '',
    email: user?.email ?? '',
    external_id: user?.external_id ?? '',
    password: '',
    must_change: true,
    status: (user?.status ?? 'active') as UserStatus,
    roles: user?.roles ?? ['participant'],
  });
  const create = useAction(
    () =>
      userApi.create({
        username: f.username.trim(),
        full_name: f.full_name,
        email: f.email || undefined,
        external_id: f.external_id || undefined,
        password: f.password || undefined,
        role_codes: f.roles,
        must_change_password: f.must_change,
      }),
    {
      success: 'Pengguna dibuat',
      invalidate: [['users']],
      toastErrors: false,
      onSuccess: (r) => {
        onClose();
        onCreated(r.user.username, r.temporary_password);
      },
    },
  );
  const update = useAction(
    () => userApi.update(user!.id, { full_name: f.full_name, email: f.email, external_id: f.external_id, status: f.status, role_codes: f.roles }),
    { success: 'Perubahan disimpan', invalidate: [['users']], toastErrors: false, onSuccess: onClose },
  );
  const action = user ? update : create;
  const toggleRole = (code: string) => setF((x) => ({ ...x, roles: x.roles.includes(code) ? x.roles.filter((r) => r !== code) : [...x.roles, code] }));
  const fe = action.fields;

  return (
    <Modal
      open
      onClose={onClose}
      title={user ? 'Ubah pengguna' : 'Tambah pengguna'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Batal
          </Button>
          <Button loading={action.isPending} onClick={() => action.mutate(undefined)}>
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Username" error={fe.username}>
            <Input value={f.username} disabled={!!user} onChange={(e) => setF({ ...f, username: e.target.value })} className="font-mono" />
          </Field>
          <Field label="NIS / ID karyawan" error={fe.external_id}>
            <Input value={f.external_id} onChange={(e) => setF({ ...f, external_id: e.target.value })} />
          </Field>
        </div>
        <Field label="Nama lengkap" error={fe.full_name}>
          <Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
        </Field>
        <Field label="Email" error={fe.email}>
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Peran" error={fe.role_codes}>
          <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            {roles.map((r) => (
              <Checkbox key={r.code} label={r.name} checked={f.roles.includes(r.code)} onChange={() => toggleRole(r.code)} />
            ))}
          </div>
        </Field>
        {user ? (
          <Field label="Status" error={fe.status}>
            <Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as UserStatus })}>
              <option value="active">Aktif</option>
              <option value="suspended">Nonaktif (tidak bisa login)</option>
            </Select>
          </Field>
        ) : (
          <>
            <Field label="Password" error={fe.password} hint="Kosongkan untuk membuat password sementara otomatis.">
              <Input type="text" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="off" />
            </Field>
            <Checkbox label="Wajib ganti password saat login pertama" checked={f.must_change} onChange={(e) => setF({ ...f, must_change: e.target.checked })} />
          </>
        )}
        {Object.keys(fe).length > 0 && <Alert>Periksa isian yang ditandai.</Alert>}
      </div>
    </Modal>
  );
}

export function PasswordModal({ user, password, onClose }: { user: string; password: string; onClose: () => void }) {
  const toast = useToast();
  return (
    <Modal open onClose={onClose} size="sm" title="Password sementara" footer={<Button onClick={onClose}>Sudah dicatat</Button>}>
      <div className="space-y-3 text-xs">
        <p>
          Berikan password ini kepada <span className="font-mono font-semibold">{user}</span>. Password hanya ditampilkan <strong>sekali</strong>.
        </p>
        <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-100 p-3 dark:bg-slate-800">
          <span className="font-mono text-lg font-bold tracking-wider">{password}</span>
          <IconButton
            label="Salin"
            onClick={() => {
              void navigator.clipboard?.writeText(password);
              toast('info', 'Password disalin');
            }}
          >
            <Copy className="h-4 w-4" />
          </IconButton>
        </div>
        <Alert tone="amber">Pengguna wajib mengganti password ini saat login pertama.</Alert>
      </div>
    </Modal>
  );
}
