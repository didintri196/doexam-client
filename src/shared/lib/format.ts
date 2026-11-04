// Dates come from the API in UTC (RFC 3339) and are shown in the institution's time zone.
let timeZone: string | undefined;

export function setTimeZone(tz: string | undefined) {
  timeZone = tz;
}

function fmt(opts: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('id-ID', { ...opts, timeZone });
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return fmt({ day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return fmt({ day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

export function formatNumber(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(n);
}

export function formatPercent(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined) return '—';
  return new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: digits }).format(n);
}

/** formatClock renders seconds as HH:MM:SS. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** toLocalInput converts an ISO date to the value of <input type="datetime-local"> (browser time). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** fromLocalInput converts a datetime-local value back to ISO (UTC). */
export function fromLocalInput(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export const labels = {
  itemType: {
    mcq_single: 'Pilihan ganda',
    mcq_multi: 'PG kompleks',
    true_false: 'Benar/Salah',
    short_answer: 'Isian singkat',
    essay: 'Esai',
  } as Record<string, string>,
  difficulty: { easy: 'Mudah', medium: 'Sedang', hard: 'Sukar' } as Record<string, string>,
  itemStatus: { draft: 'Draf', active: 'Aktif', retired: 'Pensiun' } as Record<string, string>,
  examStatus: { draft: 'Draf', published: 'Terbit', archived: 'Arsip' } as Record<string, string>,
  sessionStatus: {
    scheduled: 'Terjadwal',
    open: 'Berlangsung',
    paused: 'Dijeda',
    closed: 'Selesai',
    cancelled: 'Batal',
  } as Record<string, string>,
  attemptStatus: {
    in_progress: 'Mengerjakan',
    locked: 'Dikunci',
    submitted: 'Dikumpulkan',
    graded: 'Dinilai',
    void: 'Batal',
    not_started: 'Belum mulai',
  } as Record<string, string>,
  attendance: { expected: 'Terdaftar', present: 'Hadir', absent: 'Tidak hadir', excused: 'Izin' } as Record<string, string>,
  groupKind: {
    level: 'Tingkat',
    class: 'Kelompok',
    department: 'Departemen',
    team: 'Tim',
    batch: 'Angkatan',
    other: 'Lainnya',
  } as Record<string, string>,
  access: { viewer: 'Pembaca', editor: 'Penyunting', owner: 'Pemilik' } as Record<string, string>,
  resultVisibility: {
    immediately: 'Langsung setelah selesai',
    after_grading: 'Setelah semua dinilai',
    after_session: 'Setelah sesi ditutup',
    never: 'Tidak ditampilkan',
  } as Record<string, string>,
};
