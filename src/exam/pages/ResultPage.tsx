import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Award, CheckCircle2, Clock, MinusCircle, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router';
import { RichContent } from '@/shared/item/RichContent';
import { errorMessage } from '@/shared/lib/errors';
import { formatNumber } from '@/shared/lib/format';
import { Alert, Badge, Card, cx, Loading, PageHeader } from '@/shared/ui';
import { examApi } from '../api';
import { Shell } from '../Shell';

export function ResultPage() {
  const { id = '' } = useParams();
  const result = useQuery({
    queryKey: ['result', id],
    queryFn: () => examApi.result(id),
    // essays may still be graded: look again now and then
    refetchInterval: (q) => (q.state.data && q.state.data.pending_manual > 0 ? 60_000 : false),
  });
  const r = result.data;

  return (
    <Shell>
      <PageHeader
        title="Hasil ujian"
        back={
          <Link to="/" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Ujian saya
          </Link>
        }
      />
      {result.isLoading ? (
        <Loading />
      ) : result.error ? (
        <Alert>{errorMessage(result.error)}</Alert>
      ) : r ? (
        <div className="space-y-5">
          <Card>
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500" />
              <p className="text-lg font-extrabold text-slate-900 dark:text-white">Jawaban Anda sudah dikumpulkan</p>
              {!r.visible ? (
                <p className="max-w-md text-xs text-slate-500">Nilai belum ditampilkan. Hasil akan muncul di sini setelah dirilis oleh guru atau panitia.</p>
              ) : (
                <>
                  <div className="mt-2 flex items-end gap-1">
                    <span className="text-5xl font-extrabold tracking-tight text-blue-600">{formatNumber(r.final_score)}</span>
                    <span className="pb-1.5 text-sm text-slate-400">/ 100</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Skor mentah {formatNumber(r.raw_score)} dari {formatNumber(r.max_score)} poin
                  </p>
                  {r.passed !== undefined && (
                    <Badge tone={r.passed ? 'green' : 'red'} className="mt-1">
                      <Award className="h-3.5 w-3.5" /> {r.passed ? 'Lulus KKM' : 'Belum lulus KKM'}
                    </Badge>
                  )}
                </>
              )}
              {r.pending_manual > 0 && (
                <Alert tone="blue" className="mt-3 text-left">
                  {r.pending_manual} jawaban esai masih menunggu dinilai guru. Nilai bisa berubah.
                </Alert>
              )}
            </div>
          </Card>

          {r.visible && r.items && r.items.length > 0 && (
            <Card title="Rincian per soal">
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {r.items.map((it) => (
                  <div key={it.position} className="flex gap-3 py-3">
                    <span className="mt-0.5">
                      {it.is_correct === null ? (
                        it.score === null ? <Clock className="h-4 w-4 text-slate-400" /> : <MinusCircle className="h-4 w-4 text-amber-500" />
                      ) : it.is_correct ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-500" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-800 dark:text-slate-100">Soal {it.position}</span>
                        <span className={cx('font-mono', it.is_correct ? 'text-emerald-600' : 'text-slate-500')}>
                          {it.score === null ? 'menunggu' : formatNumber(it.score)} / {formatNumber(it.max_points)}
                        </span>
                      </div>
                      {it.explanation && (
                        <div className="mt-2 rounded-lg bg-slate-50 p-2.5 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pembahasan</p>
                          <RichContent html={it.explanation} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      ) : null}
    </Shell>
  );
}
