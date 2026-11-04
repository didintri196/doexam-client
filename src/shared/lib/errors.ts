import { ApiError } from '@/shared/api/client';

// Server messages are short English strings (apps/server/AGENTS.md §7); the client
// translates the ones users meet. Unknown messages are shown as they are.
const messages: Record<string, string> = {
  'network error': 'Tidak terhubung ke server. Periksa jaringan lalu coba lagi.',
  'invalid credentials': 'Username atau password salah.',
  'invalid input': 'Data belum valid. Periksa isian yang ditandai.',
  'invalid request body': 'Permintaan tidak valid.',
  unauthorized: 'Sesi berakhir. Silakan masuk lagi.',
  forbidden: 'Anda tidak punya akses untuk tindakan ini.',
  'not found': 'Data tidak ditemukan.',
  'already exists': 'Data sudah ada.',
  conflict: 'Tindakan tidak bisa dilakukan pada keadaan saat ini.',
  'too many requests': 'Terlalu banyak percobaan. Tunggu sebentar.',
  'internal server error': 'Terjadi kesalahan di server.',
  'service not ready': 'Server belum siap. Coba lagi sebentar.',
  'setup already completed': 'Setup sudah pernah dilakukan.',
  'setup not completed': 'Aplikasi belum di-setup.',
  'tenant not found': 'Institusi tidak ditemukan.',
  'account has no password': 'Akun ini tidak memakai password.',
  'cannot suspend, delete or reset yourself': 'Anda tidak bisa menonaktifkan, menghapus, atau me-reset akun sendiri.',
  'tenant must keep at least one active admin': 'Harus ada minimal satu admin aktif.',
  'credentials expired or already downloaded': 'Daftar akun sudah pernah diunduh atau kedaluwarsa.',
  'group still has subgroups': 'Grup masih punya subgrup.',
  'subject still has item banks': 'Subjek masih dipakai bank soal.',
  'competency is used by items': 'Kompetensi masih dipakai soal.',
  'competency still has children': 'Kompetensi masih punya turunan.',
  'item bank still has items': 'Bank masih berisi soal.',
  'item bank must keep at least one owner': 'Bank soal harus punya minimal satu pemilik.',
  'item was used in an exam; retire it instead': 'Soal sudah dipakai ujian. Pensiunkan saja.',
  'stimulus is used by items': 'Stimulus masih dipakai soal.',
  'only draft exams can be changed; unpublish it first': 'Hanya ujian draf yang bisa diubah. Batalkan terbit dulu.',
  'only draft exams can be deleted; archive it instead': 'Hanya ujian draf yang bisa dihapus. Arsipkan saja.',
  'only draft exams can be published': 'Hanya ujian draf yang bisa diterbitkan.',
  'exam already has sessions; archive it instead': 'Ujian sudah punya sesi. Arsipkan saja.',
  'publishing needs the exam.publish permission': 'Menerbitkan butuh izin exam.publish.',
  'only the creator of the exam can change it': 'Hanya pembuat ujian yang bisa mengubahnya.',
  'the exam is not published': 'Ujian belum diterbitkan.',
  'the exam is no longer published': 'Ujian tidak lagi terbit.',
  'the session is not open': 'Sesi belum dibuka pengawas.',
  'the session has not started yet': 'Sesi belum dimulai.',
  'the session has ended': 'Sesi sudah berakhir.',
  'the session window has ended': 'Waktu sesi sudah habis.',
  'late entry is closed for this session': 'Batas waktu masuk terlambat sudah lewat.',
  'you are not a participant of this session': 'Anda bukan peserta sesi ini.',
  'no attempts left for this exam': 'Kesempatan mengerjakan ujian ini sudah habis.',
  'you have a running attempt of this exam in another session': 'Anda masih punya ujian berjalan di sesi lain.',
  'this attempt is bound to another device; ask the proctor to reset it':
    'Ujian ini terkunci di perangkat lain. Minta pengawas me-reset perangkat.',
  'the attempt is locked by the proctor': 'Ujian dikunci pengawas.',
  'the attempt is already submitted': 'Ujian sudah dikumpulkan.',
  'the attempt is not in progress': 'Ujian tidak sedang berjalan.',
  'the section is not active': 'Bagian ini tidak aktif.',
  'this is the last section; submit the attempt instead': 'Ini bagian terakhir. Kumpulkan ujian.',
  'an attempt was started at the same time, please retry': 'Ujian dimulai bersamaan di tempat lain. Coba lagi.',
  'only attempts in progress can be locked': 'Hanya ujian yang berjalan yang bisa dikunci.',
  'the attempt is not locked': 'Ujian tidak sedang dikunci.',
  'the participant already started the exam': 'Peserta sudah mulai mengerjakan.',
  'the attempt already ends with the session; extend the session first':
    'Waktu ujian sudah sampai akhir sesi. Perpanjang sesi dulu.',
  'extra time needs the session.manage permission': 'Waktu tambahan butuh izin session.manage.',
  'needs the session.manage permission': 'Butuh izin session.manage.',
  'only session managers can cancel a session': 'Hanya pengelola sesi yang bisa membatalkan sesi.',
  'only scheduled sessions without attempts can be deleted; cancel or close it instead':
    'Hanya sesi terjadwal tanpa peserta mengerjakan yang bisa dihapus.',
  'a running session only accepts name, room, ends_at, late_entry_minutes and token settings':
    'Sesi berjalan hanya bisa diubah nama, ruang, waktu selesai, batas terlambat, dan token.',
  'the session already has attempts; its exam cannot change': 'Sesi sudah dikerjakan; ujiannya tidak bisa diganti.',
  'this session does not use a token': 'Sesi ini tidak memakai token.',
  'this item already has an active adjustment; revoke it first': 'Soal ini sudah punya penyesuaian aktif. Cabut dulu.',
  'the adjustment is already revoked': 'Penyesuaian sudah dicabut.',
  'only essay answers are graded manually': 'Hanya esai yang dinilai manual.',
  'this item is annulled for the exam; manual grades do not count': 'Soal ini dianulir; nilai manual tidak dihitung.',
  'the answer is empty (scored 0 automatically)': 'Jawaban kosong (otomatis bernilai 0).',
  'logo not set': 'Logo belum diatur.',
};

const fieldMessages: Record<string, string> = {
  required: 'wajib diisi',
  'already in use': 'sudah dipakai',
  'invalid or expired token': 'token salah atau kedaluwarsa',
  'max 5 MB': 'maksimal 5 MB',
  'max 20 MB': 'maksimal 20 MB',
  'must be a PNG, JPEG, GIF or WebP image, or MP3, M4A, Ogg or WAV audio': 'harus gambar PNG, JPEG, GIF, WebP atau audio MP3, M4A, Ogg, WAV',
  'cannot read image': 'gambar tidak bisa dibaca',
  'use .xlsx or .csv': 'gunakan file .xlsx atau .csv',
  'file is empty': 'file kosong',
  'cannot read file': 'file tidak bisa dibaca',
  'max 5000 rows': 'maksimal 5000 baris',
  '1-5000 identifiers': 'isi 1–5000 username, ID peserta, atau email',
  'must be another group': 'pilih grup lain',
  'group not found': 'grup tidak ditemukan',
  'max 5000 users per request': 'maksimal 5000 orang sekali tambah',
};

export function translate(msg: string): string {
  return messages[msg] ?? msg;
}

/** errorMessage turns any thrown value into a sentence for the user. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const first = Object.entries(err.fields)[0];
    if (err.status === 400 && first && Object.keys(err.fields).length === 1) {
      return `${first[0]}: ${fieldError(first[1])}`;
    }
    return translate(err.message);
  }
  return err instanceof Error ? err.message : String(err);
}

export function fieldError(msg: string | undefined): string | undefined {
  if (!msg) return undefined;
  if (msg.startsWith('no identifiers in column ')) return `kolom ${msg.slice(25)} kosong`;
  return fieldMessages[msg] ?? msg;
}

/** fieldErrors returns the per-field messages of a 400 response (empty otherwise). */
export function fieldErrors(err: unknown): Record<string, string> {
  if (err instanceof ApiError && err.status === 400) {
    return Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, fieldError(v) ?? v]));
  }
  return {};
}
