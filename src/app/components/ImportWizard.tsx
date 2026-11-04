import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Download, FileSpreadsheet, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ImportAudience, ImportJob, ImportKind } from '@/shared/api/types';
import { errorMessage, translate } from '@/shared/lib/errors';
import { formatDateTime } from '@/shared/lib/format';
import { Alert, Badge, Button, Card, EmptyState, Loading, Pagination, Spinner, Table, td, th, useToast } from '@/shared/ui';
import { importApi } from '../api';
import { useAction } from './hooks';

// One import flow for every page that imports from Excel (DOCS/PLAN/13-IMPOR-PER-MENU.md):
// template → upload → row check → import → one-time password download.

const statusLabel: Record<string, [string, 'slate' | 'blue' | 'green' | 'amber' | 'red']> = {
  pending: ['Menunggu', 'slate'],
  validating: ['Memeriksa', 'blue'],
  ready: ['Siap diimpor', 'amber'],
  importing: ['Mengimpor', 'blue'],
  done: ['Selesai', 'green'],
  failed: ['Gagal', 'red'],
};

export interface ImportTarget {
  kind: ImportKind;
  audience?: ImportAudience;
  groupId?: string;
  /** Public template file name, e.g. template-peserta.xlsx. */
  template: string;
}

// Row messages that carry values; the fixed ones go through translate().
const rowPatterns: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^existing account (\S+) is named "(.*)"; its data is not changed$/, (m) => `akun ${m[1]} terdaftar dengan nama "${m[2]}"; datanya tidak diubah`],
  [/^belongs to account (\S+), not (\S+)$/, (m) => `milik akun ${m[1]}, bukan ${m[2]}`],
  [/^duplicate of row (\d+)$/, (m) => `sama dengan baris ${m[1]}`],
  [/^unknown role: (.+)$/, (m) => `peran tidak dikenal: ${m[1]}`],
  [/^unknown group: (.+)$/, (m) => `grup tidak dikenal: ${m[1]}`],
  [/^missing columns: (.+)$/, (m) => `kolom tidak ada: ${m[1]}`],
];

function rowMessage(msg: string) {
  for (const [re, fn] of rowPatterns) {
    const m = msg.match(re);
    if (m) return fn(m);
  }
  return translate(msg);
}

/** summaryText reads the outcome of a finished job in words. */
function summaryText(j: ImportJob) {
  const s = j.summary;
  const parts = [`${s.created} ${j.kind === 'groups' ? 'grup' : 'akun'} baru`];
  if (s.added) parts.push(`${s.added} akun lama ditambahkan ke grup`);
  if (s.already_member) parts.push(`${s.already_member} sudah anggota`);
  return parts.join(', ');
}

export function ImportWizard({ target, help }: { target: ImportTarget; help?: ReactNode }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);
  const scope = { kind: target.kind, audience: target.audience, group_id: target.groupId };
  const history = useQuery({ queryKey: ['imports', scope, page], queryFn: () => importApi.list({ ...scope, page, per_page: 10 }) });
  const job = useQuery({
    queryKey: ['imports', 'job', jobId],
    queryFn: () => importApi.get(jobId!),
    enabled: !!jobId,
    refetchInterval: (q) => (q.state.data && ['pending', 'validating', 'importing'].includes(q.state.data.status) ? 1500 : false),
  });
  const upload = useAction((file: File) => importApi.upload(target.kind, file, { audience: target.audience, group_id: target.groupId }), {
    invalidate: [['imports']],
    onSuccess: (j) => setJobId(j.id),
  });
  const commit = useAction((id: string) => importApi.commit(id), {
    success: 'Impor berjalan di latar belakang',
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['imports'] }),
  });
  const status = job.data?.status;
  useEffect(() => {
    if (status !== 'done' && status !== 'failed') return;
    void qc.invalidateQueries({ queryKey: ['imports'], exact: false, predicate: (q) => q.queryKey[1] !== 'job' });
    if (status === 'done') {
      // the lists behind this page (users, group members) changed
      void qc.invalidateQueries({ queryKey: ['users'] });
      void qc.invalidateQueries({ queryKey: ['groups'] });
    }
  }, [status, qc]);
  const download = async (fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (err) {
      toast('error', 'Gagal mengunduh', errorMessage(err));
    }
  };
  const j = job.data;
  const problems = j?.errors.filter((e) => !e.warning) ?? [];
  const warnings = j?.errors.filter((e) => e.warning) ?? [];

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="1. Unggah file" className="lg:col-span-2">
          <div className="space-y-4">
            <Button variant="secondary" className="w-full" icon={<Download className="h-4 w-4" />} onClick={() => importApi.template(target.template)}>
              Unduh template
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
            {help && <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300">{help}</div>}
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
                  <p className="text-slate-500 tabular-nums">
                    {j.total_rows} baris · {j.ok_rows} valid · {j.error_rows} bermasalah
                    {warnings.length > 0 && ` · ${warnings.length} peringatan`}
                  </p>
                </div>
                <Badge tone={statusLabel[j.status][1]}>
                  {['validating', 'importing'].includes(j.status) && <Spinner className="h-3 w-3" />}
                  {statusLabel[j.status][0]}
                </Badge>
              </div>
              {j.errors.length > 0 && (
                <div className={`max-h-72 overflow-y-auto rounded-xl border ${problems.length ? 'border-rose-200 dark:border-rose-900' : 'border-amber-200 dark:border-amber-900'}`}>
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className={th}>Baris</th>
                        <th className={th}>Kolom</th>
                        <th className={th}>Keterangan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {j.errors.map((e, i) => (
                        <tr key={i}>
                          <td className={`${td} tabular-nums`}>{e.row || '—'}</td>
                          <td className={`${td} font-mono`}>{e.field ?? '—'}</td>
                          <td className={td}>
                            {e.warning ? (
                              <span className="inline-flex items-start gap-1.5 text-amber-800 dark:text-amber-300">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {rowMessage(e.message)}
                              </span>
                            ) : (
                              rowMessage(e.message)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {j.status === 'ready' && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button variant="success" loading={commit.isPending} onClick={() => commit.mutate(j.id)}>
                    Impor {j.ok_rows} baris
                  </Button>
                  {warnings.length > 0 && <span className="text-amber-700 dark:text-amber-400">Periksa peringatan di atas; baris berperingatan tetap diimpor.</span>}
                </div>
              )}
              {j.status === 'failed' && j.error_rows > 0 && <Alert>Perbaiki baris yang bermasalah lalu unggah ulang. Tidak ada data yang disimpan.</Alert>}
              {j.status === 'done' && (
                <Alert tone="green">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>Impor selesai: {summaryText(j)}.</span>
                    {j.credentials_available && (
                      <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => void download(() => importApi.credentials(j.id)).then(() => job.refetch())}>
                        Unduh password akun baru (sekali)
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
                <th className={th}>Baris</th>
                <th className={th}>Hasil</th>
                <th className={th}>Status</th>
                <th className={th}>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {history.data.items.map((h: ImportJob) => (
                <tr key={h.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setJobId(h.id)}>
                  <td className={td}>{h.file_name}</td>
                  <td className={`${td} tabular-nums`}>
                    {h.ok_rows}/{h.total_rows}
                  </td>
                  <td className={`${td} text-slate-500`}>{h.status === 'done' ? summaryText(h) : '—'}</td>
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
