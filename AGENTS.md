# DoExam Client — Aturan Coding

Berlaku untuk siapa pun (manusia maupun AI) yang menulis kode di `apps/client`. Rencana & alasan: `DOCS/PLAN/09-FRONTEND.md`.

## Struktur

```
src/
├── exam/     # entry peserta (/exam/): halaman, AttemptEngine, IndexedDB, service worker
├── app/      # entry staf (/app/): layout, halaman, api.ts (endpoint panel), komponen panel
└── shared/   # dipakai keduanya: api/ (client, tipe DTO, auth), auth/, ui/, item/ (renderer soal), lib/
```

## Aturan

1. **Batas import** (dicek `npm run check:boundaries`):
   - `exam/` hanya boleh import `shared/`.
   - `shared/` tidak boleh import `exam/` maupun `app/`.
   - Pustaka berat (editor, grafik, tabel) hanya boleh dipakai di `app/`.
2. **Ukuran bundle exam** ≤ 200 KB JS gzip saat awal dimuat (dicek `npm run check:size`). KaTeX dimuat terpisah lewat `import()`; jangan import statis.
3. **Login terpisah**: tiap entry punya token sendiri (`doexam.exam.token` / `doexam.app.token`) lewat `configureApi`. Jangan berbagi sesi antar entry.
4. **Server sumber kebenaran**: klien tidak pernah menghitung nilai atau batas waktu. Waktu ujian = `deadline_at` + selisih jam dari `server_time`.
5. **Exam client**: semua aksi peserta lewat `AttemptEngine` (`src/exam/engine.ts`). Jangan memanggil endpoint attempt langsung dari halaman. Event harus masuk outbox IndexedDB dulu; outbox dikirim ulang sampai diterima (idempoten lewat `client_event_id`). `client_seq` adalah int 32-bit di server.
6. **HTML soal** selalu dirender lewat `RichContent` (DOMPurify dengan allowlist yang sama dengan server, plus KaTeX). Jangan memakai `dangerouslySetInnerHTML` di tempat lain. Editor menyimpan rumus sebagai `<span data-math="LaTeX">`.
7. **API**:
   - Semua request lewat `api` di `shared/api/client.ts` (envelope, token, error bertipe `ApiError`).
   - Tipe DTO di `shared/api/types.ts` harus sama persis dengan `apps/server/models/*_dto.go`.
   - Endpoint khusus panel ditulis di `src/app/api.ts`.
8. **Error**:
   - Pesan server (bahasa Inggris) diterjemahkan di `shared/lib/errors.ts`.
   - Error 400 ditampilkan per field (`fieldErrors`).
   - Mutasi di panel memakai `useAction`.
9. **Gaya**:
   - Tailwind dengan komponen dari `shared/ui` (gaya prototipe DoExam: slate/biru, `rounded-xl`, mode gelap via kelas `.dark`).
   - Teks UI berbahasa Indonesia, identifier berbahasa Inggris.
10. **Izin**: menu dan tombol mengikuti `permissions` (`useCan`), tapi server tetap memvalidasi semuanya.

## Definition of Done

- `npm run check` hijau.
- Fitur yang menyentuh exam client diuji juga dalam keadaan server mati atau jaringan putus.
- Endpoint baru di server tercermin di `types.ts` dan `api.ts`.
