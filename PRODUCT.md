# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dua segmen yang sama penting sejak awal: **sekolah** (PTS/PAS, ujian harian di lab atau di HP siswa) dan **perusahaan** (rekrutmen, sertifikasi, tes internal).

- **Peserta** (siswa, kandidat, karyawan): masuk ke `/exam/`, memasukkan token ruang, mengerjakan soal dengan timer, mengumpulkan, melihat hasil bila diizinkan. Satu-satunya tugas mereka: menyelesaikan ujian tanpa bingung dan tanpa kehilangan jawaban.
- **Staf** di `/app/`, menu muncul per izin (satu orang bisa punya beberapa peran):
  - Penyusun/guru: bank soal, editor soal 5 tipe, susun & terbitkan ujian, koreksi esai.
  - Proktor/pengawas: sesi, token ruang (juga layar token besar di proyektor), monitor peserta, aksi per peserta (perpanjang, kunci, reset perangkat, kumpulkan paksa).
  - Admin: pengguna, grup, impor massal, sesi & peserta, pengaturan institusi, laporan.

## Product Purpose

Platform ujian open source (CBT & CAT) yang fokus hanya pada urusan ujian: bank soal, penyusunan, pelaksanaan, pengawasan, penilaian, analisis. Sukses Fase 1: satu institusi bisa menjalankan hari ujian penuh dari satu panel, dan peserta selesai tanpa jawaban hilang walau koneksi putus.

## Positioning

Ujian yang tetap jalan saat jaringan putus: setiap aksi peserta masuk outbox lokal dan dikirim ulang sampai diterima server, sementara server tetap satu-satunya sumber kebenaran untuk waktu dan nilai. Open source, binary tunggal, bisa dipasang sendiri oleh institusi.

## Operating Context

- Hari ujian: puluhan sampai ratusan peserta bersamaan, proktor memantau dari panel, token ruang ditampilkan di proyektor.
- Peserta memakai laptop/PC dan HP yang relatif modern; tata letak tetap harus responsif dari HP sampai desktop.
- Staf memakai panel berjam-jam: tabel, form, editor soal dengan rumus (KaTeX).
- Dua entry terpisah dengan login sendiri: exam client (PWA, offline, service worker) dan panel staf (selalu online).

## Capabilities and Constraints

- Tipe soal: PG, PG kompleks, benar/salah, isian, esai. Rumus LaTeX lewat `<span data-math>`; HTML soal selalu lewat `RichContent`.
- Exam: fullscreen di profil standard, catat keluar fokus/fullscreen, navigasi keyboard (1–5 opsi, ←/→ pindah soal, F ragu-ragu), ukuran huruf dan mode kontras tinggi untuk aksesibilitas, mode berurutan per section, `forward_only`.
- Server sumber kebenaran: klien tidak menghitung nilai atau batas waktu.
- Bundle exam ≤ 200 KB JS gzip; pustaka berat hanya di panel. Stack: React 19, Vite, Tailwind 4, lucide-react.
- Teks UI bahasa Indonesia; identifier bahasa Inggris.

## Brand Commitments

- Nama produk **DoExam** tetap. Selain itu identitas visual bebas diganti.
- Branding per institusi wajib: logo, nama, tagline, dan `primary_color` tenant tampil di header dan halaman login kedua entry, dan aksen tampilan mengikuti warna tenant.
- Mode gelap wajib didukung.
- Arah visual: standar kategori yang dieksekusi penuh, tanpa gaya tematik. Tolok ukur kerapian: Linear, Stripe Dashboard, Vercel/shadcn (dipilih pengguna, 2026-11-04).
- Footer `© DoExam · <versi>` di panel, daftar ujian/hasil peserta, dan login; tidak di ruang ujian.

## Evidence on Hand

Belum ada testimoni, pelanggan, atau angka penggunaan. Jangan mengarang klaim semacam itu.

## Product Principles

1. Jawaban peserta tidak boleh hilang, dan peserta harus selalu tahu jawabannya aman.
2. Ruang ujian menenangkan: tidak ada yang bersaing dengan soal.
3. Panel harus bisa dipakai menjalankan hari ujian dengan cepat di bawah tekanan.
4. Netral untuk sekolah dan perusahaan: profesional, tidak kekanak-kanakan, tidak korporat dingin.
5. Institusi yang terlihat, DoExam di belakang.

## Accessibility & Inclusion

Target WCAG 2.2 AA. Exam client: navigasi keyboard penuh, label screen reader, ukuran huruf yang bisa diubah, mode kontras tinggi.
