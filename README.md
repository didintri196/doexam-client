# DoExam Client

Frontend web DoExam: **exam client** untuk peserta (`/exam/`) dan **panel staf** untuk guru, pengawas, dan admin (`/app/`). Satu project, dua entry yang dibangun sebagai bundle terpisah dengan login dan sesi masing-masing. Rendering di browser (CSR); hasil build berupa file statis.

Rencana & keputusan: [`DOCS/PLAN/09-FRONTEND.md`](../../DOCS/PLAN/09-FRONTEND.md). Aturan coding: [`AGENTS.md`](AGENTS.md).

## Isi

| Entry | Untuk | Fitur |
|-------|-------|-------|
| `/exam/` | Peserta | Login, daftar ujian, token ruang, ruang ujian 5 tipe soal (PG, PG kompleks, B/S, isian, esai) dengan rumus KaTeX, ragu-ragu, navigasi keyboard, timer jam server, mode bagian berurutan, **tetap jalan saat jaringan putus** (antrean IndexedDB + service worker), layar penuh & catatan pindah tab, ukuran huruf & kontras tinggi, hasil & pembahasan, riwayat |
| `/app/` | Staf | Setup pertama, ringkasan hari ini, sesi (jadwal, token, proyektor, peserta per kelas, pengawas, buka/jeda/tutup), monitor proktor (kunci, tambah waktu, reset perangkat, kumpulkan paksa), bank soal & stimulus & editor soal (rumus LaTeX, versi), mapel & kompetensi, penyusun ujian (bagian, soal, aturan blueprint, periksa, terbit), koreksi esai dengan rubrik, anulir/ganti kunci, rekap nilai + ekspor Excel, analisis butir, laporan individu yang bisa dicetak, pengguna, kelas/grup, impor Excel, pengaturan institusi & logo |

Menu panel muncul sesuai izin akun. Akun peserta tidak bisa masuk panel, dan akun staf tidak bisa masuk halaman ujian.

## Menjalankan (development)

Butuh Node 22 dan server DoExam yang berjalan (default `http://localhost:8080`).

```bash
npm install
npm run dev
```

- Exam client: http://localhost:5173/exam/
- Panel: http://localhost:5173/app/ (instalasi baru diarahkan ke `/app/setup`)

Vite meneruskan `/api` ke server. Alamat lain: `API_URL=http://localhost:8089 npm run dev`.

## Docker

Dua image nginx tanpa Node saat runtime. Masing-masing menyajikan satu entry dan meneruskan `/api` ke server (`API_UPSTREAM`).

```bash
docker build -f Dockerfile.exam -t doexam-exam .
docker build -f Dockerfile.panel -t doexam-panel .
docker run -p 8081:8080 -e API_UPSTREAM=http://host.docker.internal:8080 doexam-exam
docker run -p 8082:8080 -e API_UPSTREAM=http://host.docker.internal:8080 doexam-panel
```

Atau keduanya sekaligus (server dari `apps/server` sudah berjalan di port 8080):

```bash
docker compose up --build
```

| Image | Port contoh | `/` dialihkan ke | Catatan |
|-------|-------------|------------------|---------|
| `Dockerfile.exam` | 8081 | `/exam/` | CSP paling ketat, service worker `/exam/sw.js` tanpa cache, aset `immutable` |
| `Dockerfile.panel` | 8082 | `/app/` | Tanpa service worker |

| Env | Default | Keterangan |
|-----|---------|------------|
| `API_UPSTREAM` | `http://server:8080` | Alamat server DoExam yang dituju `/api` |

Image memakai `nginxinc/nginx-unprivileged` (tidak berjalan sebagai root) dan punya healthcheck `GET /healthz`.

> Di belakang proxy, server saat ini mencatat IP proxy (bukan IP peserta) di audit log; lihat gap #11 di 09-FRONTEND.

## Perintah

| Perintah | Fungsi |
|----------|--------|
| `npm run dev` | Server pengembangan kedua entry |
| `npm run build` | Typecheck + build kedua entry ke `dist/all` |
| `npm run build:exam` / `build:panel` | Build satu entry ke `dist/exam` / `dist/panel` |
| `npm run check` | Typecheck, cek batas import, build, cek anggaran ukuran bundle exam (≤ 200 KB gzip) |
