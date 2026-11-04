import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CheckCircle2, Download, FileText, FileUp, TriangleAlert } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ApiError } from '@/shared/api/client';
import type { WordImport, WordIssue, WordItem } from '@/shared/api/types';
import { StaticMedia } from '@/shared/item/media';
import { RichContent } from '@/shared/item/RichContent';
import { errorMessage, fieldErrors } from '@/shared/lib/errors';
import { formatNumber, labels } from '@/shared/lib/format';
import { Alert, Badge, Button, Card, Checkbox, cx, EmptyState, Loading, PageHeader } from '@/shared/ui';
import { bankApi } from '../api';
import { useAction } from '../components/hooks';

// Server messages are English (API rule); these are the ones an author meets while importing.
const issueText: Record<string, string> = {
  'answer key letter does not match an option': 'Huruf kunci tidak cocok dengan pilihan mana pun.',
  'answer key missing: add "Kunci: B" or mark the option with *': 'Kunci belum ada. Tambahkan baris "Kunci: B" atau tanda * di depan huruf pilihan yang benar.',
  'single choice needs exactly one answer; use Jenis: pgk for several': 'Pilihan ganda hanya boleh satu kunci. Pakai "Jenis: pgk" bila jawabannya lebih dari satu.',
  'answer key missing: "Kunci: Benar" or "Kunci: Salah"': 'Kunci belum ada. Tulis "Kunci: Benar" atau "Kunci: Salah".',
  'true/false key must be Benar or Salah': 'Kunci soal benar/salah harus "Benar" atau "Salah".',
  'answer key missing: "Kunci: jawaban" (several: jawaban1 | jawaban2)': 'Kunci belum ada. Tulis "Kunci: jawaban" (beberapa jawaban: jawaban1 | jawaban2).',
  'score must be a number from 0 to 1000': 'Skor harus angka antara 0 dan 1000.',
  'reading text is empty': 'Bacaan untuk soal ini kosong.',
  'options of a true/false item are ignored': 'Pilihan pada soal benar/salah diabaikan.',
  'options of a short-answer item are ignored': 'Pilihan pada soal isian diabaikan.',
  'options of an essay item are ignored': 'Pilihan pada soal esai diabaikan.',
  required: 'wajib diisi',
  '2-10 options': 'perlu 2 sampai 10 pilihan',
  'must be the id of one option': 'harus menunjuk satu pilihan',
  'must be a non-empty list of distinct option ids': 'harus menunjuk pilihan yang berbeda',
};
const fieldName: Record<string, string> = {
  'content.stem': 'Pertanyaan',
  'content.options': 'Pilihan',
  answer_key: 'Kunci',
  'answer_key.correct': 'Kunci',
  'answer_key.accepted': 'Kunci',
  competency: 'Kompetensi',
  default_points: 'Skor',
  stimulus: 'Bacaan',
};

function issue(i: WordIssue): string {
  const competency = /^competency "(.+)" not found in this bank's subject$/.exec(i.message);
  if (competency) return `Kompetensi "${competency[1]}" tidak ada di subjek bank ini.`;
  const text = issueText[i.message] ?? i.message;
  const field = i.field && !i.message.startsWith('answer key') && !['competency', 'default_points', 'stimulus', 'answer_key'].includes(i.field) ? fieldName[i.field.replace(/\[\d+\].*$/, '')] : '';
  return field ? `${field}: ${text}` : text;
}

function docWarning(w: string): string {
  const pic = /^picture (.+) skipped: (use PNG, JPEG, GIF or WebP|larger than 5 MB)$/.exec(w);
  if (pic) return `Gambar ${pic[1]} dilewati: ${pic[2].startsWith('use') ? 'gunakan PNG, JPEG, GIF, atau WebP' : 'lebih dari 5 MB'}.`;
  const type = /^unknown item type "(.*)"/.exec(w);
  if (type) return `Jenis "${type[1]}" tidak dikenal. Gunakan pg, pgk, bs, isian, atau esai.`;
  const early = /^"(.+)" before the first item skipped$/.exec(w);
  if (early) return `Baris "${early[1]}:" sebelum soal pertama diabaikan.`;
  return (
    {
      'equation partly converted': 'Sebagian rumus tidak bisa dikonversi penuh. Periksa soal yang memakai rumus.',
      'embedded object (old equation editor or OLE) skipped': 'Objek tertanam (Equation Editor lama atau OLE) dilewati. Ketik ulang rumusnya dengan Insert → Equation.',
      'table outside an item or reading text skipped': 'Tabel di luar soal atau bacaan diabaikan.',
      'text before the first item skipped': 'Teks sebelum soal pertama diabaikan (mis. petunjuk templat).',
    } as Record<string, string>
  )[w] ?? w;
}

/** WordImportPage: pick a .docx, check every item in a preview, then save the valid ones as drafts. */
export function WordImportPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const bank = useQuery({ queryKey: ['banks', id], queryFn: () => bankApi.get(id) });
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<WordImport | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [readError, setReadError] = useState<string>();

  const read = useAction((f: File) => bankApi.importWord(id, f, true), {
    toastErrors: false,
    onSuccess: (r) => {
      setPreview(r);
      setReadError(undefined);
      setOnlyProblems(r.invalid > 0);
    },
  });
  const template = useAction(async () => {
    try {
      await bankApi.wordTemplate();
    } catch (err) {
      // a server older than the import feature has no template route
      if (err instanceof ApiError && err.status === 404) throw new Error('Templat tidak ditemukan di server. Pastikan server DoExam sudah versi terbaru, lalu coba lagi.');
      throw err;
    }
  });
  const save = useAction(() => bankApi.importWord(id, file!, false), {
    success: (r) => `${formatNumber(r.created)} soal tersimpan sebagai draf${r.created_stimuli ? ` dengan ${r.created_stimuli} bacaan` : ''}`,
    invalidate: [['items'], ['banks']],
    onSuccess: (r) => setPreview(r),
  });

  const pick = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setPreview(null);
    setReadError(undefined);
    read.mutate(f, { onError: (err) => setReadError(fieldErrors(err).file ?? errorMessage(err)) });
  };

  const items = preview ? (onlyProblems ? preview.items.filter((i) => i.errors.length) : preview.items) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        back={
          <Link to={`/banks/${id}`} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" /> {bank.data?.name ?? 'Bank soal'}
          </Link>
        }
        title="Impor soal dari Word"
        subtitle="Soal dibaca dulu dan diperiksa satu per satu. Yang valid disimpan sebagai draf; yang bermasalah dilewati."
      />

      <input ref={input} type="file" accept=".docx" className="sr-only" aria-label="Pilih file Word" onChange={(e) => {
        pick(e.target.files?.[0]);
        e.target.value = '';
      }} />

      {preview?.committed ? (
        <Card>
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              {formatNumber(preview.created)} soal tersimpan sebagai draf
              {preview.created_stimuli > 0 && `, beserta ${preview.created_stimuli} bacaan`}
            </p>
            {preview.invalid > 0 && <p className="text-xs text-slate-500">{formatNumber(preview.invalid)} soal bermasalah dilewati. Perbaiki di file lalu impor lagi.</p>}
            <p className="max-w-md text-xs text-slate-500">Periksa soal di bank, lalu ubah statusnya menjadi aktif agar bisa dipakai di ujian.</p>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={() => { setPreview(null); setFile(null); }}>
                Impor file lain
              </Button>
              <Button onClick={() => navigate(`/banks/${id}`)}>Buka bank soal</Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <FileText className="h-8 w-8 shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{file ? file.name : 'Belum ada file'}</p>
                <p className="text-xs text-slate-500">
                  Soal bernomor 1., 2., …; pilihan A., B., …; tandai jawaban dengan <span className="font-mono">Kunci:</span> atau <span className="font-mono">*</span>. Maks. 300 soal, 20 MB.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="ghost" icon={<Download className="h-4 w-4" />} loading={template.isPending} onClick={() => template.mutate(undefined)}>
                Unduh templat
              </Button>
              <Button variant={preview ? 'secondary' : 'primary'} icon={<FileUp className="h-4 w-4" />} loading={read.isPending} onClick={() => input.current?.click()}>
                {file ? 'Ganti file' : 'Pilih file .docx'}
              </Button>
            </div>
          </div>
          {readError && (
            <Alert className="mt-4">
              {
                ({
                  'use a .docx file (Word 2007 or newer)': 'Gunakan file .docx (Word 2007 atau lebih baru). File .doc lama perlu disimpan ulang sebagai .docx.',
                  'no items found; number them 1., 2., … (see the template)': 'Tidak ada soal yang terbaca. Beri nomor soal 1., 2., … seperti di templat.',
                  'max 300 items per file': 'Maksimal 300 soal per file. Bagi menjadi beberapa file.',
                  'cannot read the document': 'Dokumen tidak bisa dibaca. Simpan ulang dari Word lalu coba lagi.',
                  'document or picture too large': 'Dokumen atau salah satu gambarnya terlalu besar.',
                  'required, max 20 MB': 'File wajib dipilih, maksimal 20 MB.',
                } as Record<string, string>)[readError] ?? readError
              }
            </Alert>
          )}
        </Card>
      )}

      {read.isPending && <Loading label="Membaca dokumen…" />}

      {preview && !preview.committed && (
        <StaticMedia refs={preview.media}>
          <div className="space-y-4">
            <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
              <p className="text-xs text-slate-700 dark:text-slate-300">
                <span className="font-semibold tabular-nums">{formatNumber(preview.items.length)}</span> soal terbaca ·{' '}
                <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">{formatNumber(preview.valid)}</span> siap disimpan
                {preview.invalid > 0 && (
                  <>
                    {' · '}
                    <span className="font-semibold tabular-nums text-rose-600 dark:text-rose-400">{formatNumber(preview.invalid)}</span> bermasalah
                  </>
                )}
                {preview.stimuli > 0 && ` · ${preview.stimuli} bacaan`}
              </p>
              <div className="flex items-center gap-4">
                {preview.invalid > 0 && <Checkbox label="Hanya yang bermasalah" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />}
                <Button disabled={!preview.valid} loading={save.isPending} onClick={() => save.mutate(undefined)}>
                  Simpan {formatNumber(preview.valid)} soal
                </Button>
              </div>
            </div>

            {preview.warnings.length > 0 && (
              <Alert tone="amber">
                <ul className="list-disc space-y-0.5 pl-4">
                  {preview.warnings.map((w) => (
                    <li key={w}>{docWarning(w)}</li>
                  ))}
                </ul>
              </Alert>
            )}

            {items.length === 0 ? (
              <EmptyState title="Tidak ada soal bermasalah">Semua soal siap disimpan.</EmptyState>
            ) : (
              items.map((it, i) => {
                // show a reading text once, above the first listed item that uses it
                const reading = it.stimulus && items.findIndex((x) => x.stimulus === it.stimulus) === i ? preview.readings.find((r) => r.title === it.stimulus) : undefined;
                return (
                  <div key={it.no} className="space-y-4">
                    {reading && (
                      <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30">
                        <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
                          <FileText className="h-3.5 w-3.5 text-blue-600" /> Bacaan: {reading.title}
                        </h2>
                        <RichContent html={reading.body || '<p>(bacaan kosong)</p>'} className="text-sm text-slate-800 dark:text-slate-200" />
                      </section>
                    )}
                    <PreviewItem item={it} />
                  </div>
                );
              })
            )}
          </div>
        </StaticMedia>
      )}
    </div>
  );
}

function PreviewItem({ item: it }: { item: WordItem }) {
  const bad = it.errors.length > 0;
  return (
    <article
      className={cx(
        'rounded-xl border bg-white p-4 shadow-xs dark:bg-slate-900',
        bad ? 'border-rose-300 dark:border-rose-900' : 'border-slate-200 dark:border-slate-800',
      )}
    >
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">Soal {it.no}</h2>
        <Badge>{labels.itemType[it.type]}</Badge>
        {it.points != null && <span className="text-xs tabular-nums text-slate-500">{formatNumber(it.points)} poin</span>}
        {it.stimulus && <Badge tone="blue">Bacaan: {it.stimulus}</Badge>}
        {it.competency && <span className="font-mono text-[11px] text-slate-500">{it.competency}</span>}
        <span className="ml-auto">{bad ? <Badge tone="red">Bermasalah</Badge> : <Badge tone="green">Siap</Badge>}</span>
      </header>
      <RichContent html={it.stem || '<p>(pertanyaan kosong)</p>'} className="text-sm text-slate-900 dark:text-slate-100" />
      {it.options && it.options.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {it.options.map((o) => (
            <li
              key={o.label}
              className={cx(
                'flex items-start gap-2.5 rounded-lg border px-3 py-2 text-xs',
                o.correct ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700',
              )}
            >
              <span className={cx('font-semibold tabular-nums', o.correct ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500')}>{o.label}</span>
              <RichContent html={o.body} className="flex-1" />
              {o.correct && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Jawaban benar" />}
            </li>
          ))}
        </ul>
      )}
      {it.key && it.type !== 'mcq_single' && it.type !== 'mcq_multi' && (
        <p className="mt-3 text-xs text-slate-700 dark:text-slate-300">
          <span className="font-medium">Kunci:</span> {it.key}
        </p>
      )}
      {it.explanation && (
        <details className="mt-3 text-xs text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer font-medium">Pembahasan</summary>
          <RichContent html={it.explanation} className="mt-1" />
        </details>
      )}
      {(it.errors.length > 0 || it.warnings.length > 0) && (
        <ul className="mt-3 space-y-1 text-xs">
          {it.errors.map((e, i) => (
            <li key={`e${i}`} className="flex gap-1.5 text-rose-700 dark:text-rose-400">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {issue(e)}
            </li>
          ))}
          {it.warnings.map((w, i) => (
            <li key={`w${i}`} className="text-amber-700 dark:text-amber-400">
              {issue(w)}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
