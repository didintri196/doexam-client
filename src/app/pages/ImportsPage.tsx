import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ImportJob, ImportKind } from '@/shared/api/types';
import { errorMessage } from '@/shared/lib/errors';
import { formatDateTime } from '@/shared/lib/format';
import { Alert, Badge, Button, Card, EmptyState, Loading, PageHeader, Pagination, Select, Spinner, Table, td, th, useToast } from '@/shared/ui';
import { importApi } from '../api';
import { useAction } from '../components/hooks';

const statusLabel: Record<string, [string, 'slate' | 'blue' | 'green' | 'amber' | 'red']> = {
  pending: ['Menunggu', 'slate'],
  validating: ['Memeriksa', 'blue'],
  ready: ['Siap diimpor', 'amber'],
  importing: ['Mengimpor', 'blue'],
  done: ['Selesai', 'green'],
  failed: ['Gagal', 'red'],
};

export function ImportsPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const [kind, setKind] = useState<ImportKind>('users');
  const [jobId, setJobId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const history = useQuery({ queryKey: ['imports', page], queryFn: () => importApi.list({ page, per_page: 10 }) });
  const job = useQuery({
    queryKey: ['imports', 'job', jobId],
    queryFn: () => importApi.get(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data && ['pending', 'validating', 'importing'].includes(q.state.data.status) ? 1500 : false),
  });
  const upload = useAction((file: File) => importApi.upload(kind, file), {
    invalidate: [['imports']],
    onSuccess: (j) => setJobId(j.id),
  });
  const commit = useAction((id: string) => importApi.commit(id), {
    success: 'Impor berjalan di latar belakang',
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['imports'] }),
  });
  const download = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      toast('error', 'Gagal mengunduh', errorMessage(err));
    }
  };
  const j = job.data;

  return (
    <>
      <PageHeader title="Impor dari Excel" subtitle="Tambahkan ratusan siswa atau kelas sekaligus. Semua baris diperiksa dulu sebelum disimpan." />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="1. Unggah file" className="lg:col-span-2">
          <div className="space-y-4">
            <Select value={kind} onChange={(e) => setKind(e.target.value as ImportKind)}>
              <option value="users">Pengguna (siswa, guru)</option>
              <option value="groups">Kelas / grup</option>
            </Select>
            <Button variant="secondary" className="w-full" icon={<Download className="h-4 w-4" />} onClick={() => void download(() => importApi.template(kind))}>
              Unduh template {kind === 'users' ? 'pengguna' : 'grup'}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload.mutate(f);
                e.target.value = '';
              }}
            />
            <Button className="w-full" icon={<Upload className="h-4 w-4" />} loading={upload.isPending} onClick={() => fileRef.current?.click()}>
              Pilih file .xlsx / .csv
            </Button>
            <p className="text-[11px] text-slate-500">Maksimal 5 MB / 2.000 baris. Kolom harus sama dengan template.</p>
          </div>
        </Card>

        <Card title="2. Periksa & impor" className="lg:col-span-3">
          {!jobId ? (
            <EmptyState icon={<FileSpreadsheet className="h-10 w-10" />} title="Belum ada file">
              Hasil pemeriksaan tiap baris muncul di sini.
            </EmptyState>
          ) : !j ? (
            <Loading />
          ) : (
            <div className="space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{j.file_name}</p>
                  <p className="text-slate-500">
                    {j.total_rows} baris · {j.ok_rows} valid · {j.error_rows} bermasalah
                  </p>
                </div>
                <Badge tone={statusLabel[j.status][1]}>
                  {['validating', 'importing'].includes(j.status) && <Spinner className="h-3 w-3" />}
                  {statusLabel[j.status][0]}
                </Badge>
              </div>
              {j.errors.length > 0 && (
                <div className="max-h-64 overflow-y-auto rounded-xl border border-rose-200 dark:border-rose-900">
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className={th}>Baris</th>
                        <th className={th}>Kolom</th>
                        <th className={th}>Masalah</th>
                      </tr>
                    </thead>
                    <tbody>
                      {j.errors.map((e, i) => (
                        <tr key={i}>
                          <td className={td}>{e.row}</td>
                          <td className={`${td} font-mono`}>{e.field ?? '—'}</td>
                          <td className={td}>{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {j.status === 'ready' && (
                <Button variant="success" loading={commit.isPending} onClick={() => commit.mutate(j.id)}>
                  Impor {j.ok_rows} baris
                </Button>
              )}
              {j.status === 'failed' && j.error_rows > 0 && <Alert>Perbaiki baris yang bermasalah lalu unggah ulang. Tidak ada data yang disimpan.</Alert>}
              {j.status === 'done' && (
                <Alert tone="green">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Impor selesai.</span>
                    {j.credentials_available && (
                      <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => void download(() => importApi.credentials(j.id)).then(() => job.refetch())}>
                        Unduh daftar akun (sekali)
                      </Button>
                    )}
                  </div>
                </Alert>
              )}
            </div>
          )}
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold">Riwayat impor</h2>
      {history.isLoading ? (
        <Loading />
      ) : !history.data?.items.length ? (
        <p className="text-xs text-slate-500">Belum ada.</p>
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <th className={th}>File</th>
                <th className={th}>Jenis</th>
                <th className={th}>Baris</th>
                <th className={th}>Status</th>
                <th className={th}>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {history.data.items.map((h: ImportJob) => (
                <tr key={h.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setJobId(h.id)}>
                  <td className={td}>{h.file_name}</td>
                  <td className={td}>{h.kind === 'users' ? 'Pengguna' : 'Grup'}</td>
                  <td className={td}>
                    {h.ok_rows}/{h.total_rows}
                  </td>
                  <td className={td}>
                    <Badge tone={statusLabel[h.status][1]}>{statusLabel[h.status][0]}</Badge>
                  </td>
                  <td className={td}>{formatDateTime(h.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} perPage={10} total={history.data.total} onPage={setPage} />
        </>
      )}
    </>
  );
}
