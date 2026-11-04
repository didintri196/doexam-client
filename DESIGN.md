---
name: DoExam
description: Platform ujian CBT & CAT yang tetap jalan saat jaringan putus; ruang ujian tenang, panel staf padat, aksen milik institusi.
colors:
  accent: "#2563eb"
  accent-hover: "#1b4dba"
  accent-wash: "#f1f6ff"
  accent-fg: "#ffffff"
  accent-fg-light-tenant: "#0f172a"
  saved-emerald: "#059669"
  saved-emerald-dot: "#10b981"
  saved-emerald-wash: "#ecfdf5"
  doubt-amber: "#fcd34d"
  doubt-amber-ring: "#f59e0b"
  doubt-amber-wash: "#fffbeb"
  critical-rose: "#e11d48"
  critical-rose-wash: "#fff1f2"
  canvas-slate: "#f8fafc"
  surface-white: "#ffffff"
  hairline-slate: "#e2e8f0"
  control-stroke-slate: "#cbd5e1"
  muted-ink-slate: "#64748b"
  body-ink-slate: "#334155"
  ink-slate: "#0f172a"
  dark-canvas-slate: "#020617"
  dark-surface-slate: "#0f172a"
  dark-hairline-slate: "#1e293b"
  hc-black: "#000000"
  hc-yellow: "#fde047"
typography:
  display:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
    fontFeature: "'cv11', 'ss01', 'ss03', 'tnum'"
  headline:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.375rem
  body:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.25rem
  exam-reading:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1rem
  timer:
    fontFamily: "Inter Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    letterSpacing: "-0.025em"
    fontFeature: "'tnum'"
  code:
    fontFamily: "ui-monospace, SFMono-Regular, JetBrains Mono, Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
rounded:
  sm: "4px"
  md: "5px"
  lg: "6px"
  xl: "8px"
  2xl: "12px"
  full: "9999px"
spacing:
  1: "4px"
  1.5: "6px"
  2: "8px"
  2.5: "10px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-primary-lg:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.lg}"
    padding: "0 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "32px"
  button-danger:
    backgroundColor: "{colors.critical-rose}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "32px"
  input:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-slate}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  card:
    backgroundColor: "{colors.surface-white}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  badge:
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "2px 6px"
  answer-option:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink-slate}"
    typography: "{typography.exam-reading}"
    rounded: "{rounded.xl}"
    padding: "12px 16px"
  answer-option-selected:
    backgroundColor: "{colors.accent-wash}"
    textColor: "{colors.ink-slate}"
  nav-cell-empty:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.body-ink-slate}"
    rounded: "{rounded.lg}"
    height: "36px"
  nav-cell-answered:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.lg}"
    height: "36px"
  nav-cell-flagged:
    backgroundColor: "{colors.doubt-amber}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.lg}"
    height: "36px"
  save-pill:
    backgroundColor: "{colors.saved-emerald-wash}"
    textColor: "{colors.saved-emerald}"
    typography: "{typography.body}"
    rounded: "{rounded.full}"
    padding: "0 12px"
    height: "32px"
  timer:
    typography: "{typography.timer}"
    textColor: "{colors.ink-slate}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "40px"
  sidebar-link:
    textColor: "{colors.muted-ink-slate}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  sidebar-link-active:
    backgroundColor: "#f1f5f9"
    textColor: "{colors.ink-slate}"
---

# Design System: DoExam

## Overview

**Creative North Star: "Ruang Ujian Milik Institusi"**

Standar kategori yang dieksekusi pada tingkat Linear dan Stripe Dashboard: kanvas slate, permukaan putih bergaris rambut, dan satu aksen yang bukan milik DoExam tetapi milik institusi (`primary_color` tenant). DoExam berdiri di belakang; nama, logo, dan warna sekolah atau perusahaan yang tampil di depan. Sistem ini sengaja polos: tidak ada gaya tematik, tidak ada dekorasi yang bersaing dengan soal.

Dua kepadatan hidup di satu sistem. Ruang ujian lega dan tenang: teks soal 16px, opsi berupa baris bergaris dengan bulatan huruf, navigator nomor yang statusnya terbaca dari isi dan garis, bukan hanya warna. Panel staf padat tapi tetap terbaca: teks kerja 13px, tabel angka tabular, sidebar 240px ala Linear. Keduanya memakai komponen yang sama dari `src/shared/ui`.

Kepercayaan dibangun dengan bukti, bukan klaim: status simpan selalu disertai jam sinkron terakhir atau jumlah antrean. Mode gelap wajib dan setara; mode kontras tinggi (hitam dan kuning) tersedia di ruang ujian.

**Key Characteristics:**
- Satu aksen milik tenant, ditambah tiga hue status (emerald, amber, rose) di atas slate.
- Seluruh skala `blue-*` diturunkan dari `--accent`, sehingga utilitas biru mana pun mengikuti warna tenant.
- Permukaan datar bergaris 1px, bayangan sangat halus dan berjarak.
- Inter Variable untuk semua teks termasuk angka (tabular-nums); monospace hanya untuk kode, token, dan LaTeX.
- Status terbaca tanpa warna: isi vs garis, tanda sudut, titik.

## Colors

Slate netral yang dingin dengan satu aksen institusi dan tiga warna status yang masing-masing punya satu makna.

### Primary
- **Aksen Institusi** (default #2563eb, nilai sebenarnya = `primary_color` tenant lewat `applyBrand` di `src/shared/lib/brand.ts`): aksi utama (termasuk "Kumpulkan ujian"), opsi jawaban terpilih, tile navigator yang sudah dijawab, tab aktif, ikon menu aktif, cincin fokus, seleksi teks, caret, avatar pengguna. Hover menggelap ke campuran 84% aksen dengan hitam.
- **Teks di Atas Aksen** (#ffffff, atau #0f172a untuk warna tenant terang): `text-accent-fg`. `brand.ts` menghitung kontras putih terhadap aksen; di bawah 4.5:1 teks berganti ke hampir-hitam.
- **Skala Turunan**: `blue-50` sampai `blue-950` adalah `color-mix(in oklab, var(--accent) N%, white|black)` di `src/shared/styles.css`. Wash terpilih memakai `blue-50`, ring fokus input memakai `blue-500` 20%.

### Secondary (status)
- **Emerald Tersimpan** (#059669, titik #10b981): "tersimpan di server" (pill simpan) dan sukses (toast, alert hijau, badge hijau, status Dikumpulkan di monitor).
- **Amber Ragu** (#fcd34d isi, #f59e0b garis): ragu-ragu di navigator dan tombol Ragu-ragu, offline pada pill simpan, peringatan, peserta dikunci.
- **Rose Kritis** (#e11d48): timer di bawah 5 menit, aksi destruktif, error, "Perlu perhatian" di monitor.

### Neutral
- **Kanvas Slate** (#f8fafc; gelap #020617): latar halaman kedua entry.
- **Permukaan Putih** (#ffffff; gelap #0f172a): kartu, tabel, header ruang ujian, sidebar.
- **Garis Rambut** (#e2e8f0; gelap #1e293b): batas kartu, pemisah header, garis tabel.
- **Garis Kontrol** (#cbd5e1): input, tile navigator kosong, bulatan huruf opsi.
- **Tinta Redup** (#64748b): subjudul, meta, kepala tabel.
- **Tinta Isi** (#334155): sel tabel, label field.
- **Tinta** (#0f172a): judul dan teks soal.
- **Kontras Tinggi** (#000000 dengan #fde047): mode aksesibilitas ruang ujian, menimpa semua warna.

### Named Rules
**The One Accent Rule.** Palet adalah satu aksen tenant ditambah tiga hue status (emerald, amber, rose) di atas slate. Tidak ada hue keempat. Kunci `purple` pada tipe `Badge` adalah sisa yang tidak dipakai halaman mana pun dan bukan bagian sistem.

**The Green Means Saved Rule.** Hijau hanya untuk "tersimpan di server" dan sukses. Tile navigator yang dijawab dan tombol "Kumpulkan ujian" memakai aksen, karena hijau akan terbaca "aman/selesai" padahal soal masih kosong, dan ruangan membawa identitas institusi. *(Amandemen terhadap direction contract `.impeccable/surfaces/src.md`, yang semula menulis "hijau tersimpan/dijawab"; diwajibkan reviewer finish.)*

**The Derived Blue Rule.** Jangan menulis hex biru. Semua `blue-*` adalah turunan aksen; teks di atas isi aksen selalu `text-accent-fg`, tidak pernah `text-white`.

## Typography

**Display Font:** Inter Variable (dengan system-ui, -apple-system, Segoe UI)
**Body Font:** Inter Variable
**Label/Mono Font:** ui-monospace, SFMono-Regular, JetBrains Mono (hanya kode)

**Character:** Satu keluarga sans yang netral dan rapat, dengan fitur `cv11`, `ss01`, `ss03` aktif di root. Hierarki dibangun dari berat (500/600) dan ukuran, bukan dari keluarga kedua.

### Hierarchy
- **Display** (600, 1.5rem, tracking -0.025em, tabular): angka statistik di kartu Stat.
- **Headline** (600, 1.25rem): judul halaman panel dan judul login (`text-xl`). Judul proyektor naik ke 3rem.
- **Title** (600, 0.875rem): judul kartu, judul modal, judul header ruang ujian. "Soal N" di ruang ujian memakai 1.125rem.
- **Body** (400, 0.8125rem / 1.25rem): ukuran kerja panel. `text-xs` Tailwind dipetakan ulang ke 13px.
- **Exam Reading** (400, 1rem, line-height 1.65, maks 72ch): stem dan opsi soal. A / A+ / A++ = 16 / 18 / 20px.
- **Label** (500, 0.6875rem): badge, label grup sidebar, legenda navigator, footer. Selalu sentence case.
- **Timer** (600, 1.125rem, tabular): sisa waktu di header ruang ujian.
- **Print** (dokumen sesi A4 di `/app/sessions/:id/print/:doc`): judul 15px/700 kapital, isi 12px, tabel dan meta 11px, label kartu 10px, catatan kecil 9px. Kertas dibaca dari dekat dan dicetak hitam-putih, jadi skala ini terpisah dari skala layar dan tidak tunduk pada The Thirteen Rule.

### Named Rules
**The Tabular Inter Rule.** Angka (timer, hitungan, tabel, nomor soal, statistik) memakai Inter dengan `tabular-nums`. Monospace hanya untuk kode, token ruang, username, kode kompetensi, dan LaTeX.

**The Thirteen Rule.** Ukuran kerja panel 13px; ukuran baca ujian 16px. Teks 12px tidak dipakai; 11px hanya untuk label meta.

## Layout

Panel staf: sidebar tetap 240px di kiri (≥768px), header 56px dengan tombol menu di bawah 768px dan laci 288px. Konten dibatasi 1280px (`max-w-7xl`) dengan padding 16 / 24 / 32px per breakpoint dan vertikal 24–32px. Header halaman berjarak 24px ke konten.

Ruang ujian: header putih lengket 64px (logo + nama institusi + ujian di kiri; pill simpan + timer + alat tampilan di kanan), lalu grid dua kolom `1fr / 320px` di ≥1024px dengan jarak 24px. Kartu soal mengisi tinggi viewport, tombol Sebelumnya / Ragu-ragu / Berikutnya di dasar kartu. Navigator 5 kolom di desktop, 10 kolom di tablet, 8 kolom di HP, dan menempel di bawah header.

Ritme ruang: skala 4px; celah antar kontrol 6–8px, padding kartu 16px, padding kartu soal 20–32px, jarak antar opsi 10px.

### Named Rules
**The Institution Foot Rule.** Di HP (<640px) header ujian menyembunyikan logo tenant agar judul dan hitungan soal tetap terbaca; lockup institusi pindah ke kaki kolom navigator, di bawah tombol kumpulkan.

## Elevation & Depth

Datar dengan bayangan berjarak. Kedalaman utama datang dari garis 1px dan perbedaan tonal kanvas slate vs permukaan putih; bayangan hanya memberi angkat tipis, berwarna slate-900 dengan alfa rendah. Overlay memakai scrim slate-950 40–60%.

### Shadow Vocabulary
- **xs** (`0 1px 2px 0 rgb(15 23 42 / 0.05)`): kartu, tabel, tombol, input dalam keadaan diam.
- **sm** (`0 1px 2px 0 rgb(15 23 42 / 0.06), 0 1px 3px 0 rgb(15 23 42 / 0.04)`): kartu login.
- **lg** (`0 8px 24px -6px rgb(15 23 42 / 0.12), 0 2px 6px -2px rgb(15 23 42 / 0.06)`): menu pop-up akun.
- **xl** (`0 16px 40px -12px rgb(15 23 42 / 0.18), 0 4px 10px -4px rgb(15 23 42 / 0.06)`): toast.
- **2xl** (`0 24px 56px -16px rgb(15 23 42 / 0.28)`): modal, overlay ruang ujian, laci menu HP.

### Named Rules
**The Hairline First Rule.** Setiap permukaan punya garis 1px; bayangan tidak pernah menggantikan garis.

## Shapes

Sudut kecil dan konsisten per peran: kontrol 6px (tombol, input, tile navigator, link sidebar), baris dan blok dalam 8px (opsi jawaban, alert, bacaan stimulus, menu pop-up), panel 12px (kartu, tabel, modal, toast). Lingkaran penuh untuk pill simpan, bulatan huruf opsi, avatar, dan titik status. Radius Tailwind dipetakan ulang di `styles.css` sehingga `rounded-lg` = 6px, `rounded-xl` = 8px, `rounded-2xl` = 12px. *(Contract menulis 8px kontrol / 12px panel; build mengirim kontrol 6px dan 8px untuk blok dalam. Build berlaku.)*

## Components

### Buttons
Tenang dan pasti; berat ada di warna, bukan ukuran.
- **Shape:** 6px, tinggi 28 / 32 / 40px (sm / md / lg), berat 500, ikon 16px dengan celah 6px.
- **Primary:** isi aksen, teks `accent-fg`, bayangan xs; hover ke aksen 84% gelap. Dipakai untuk aksi utama termasuk "Kumpulkan ujian" dan "Berikutnya".
- **Secondary:** putih bergaris slate-200, hover slate-50.
- **Ghost:** teks slate-600, hover latar slate-100.
- **Danger / Warning:** rose-600 dan amber-400 untuk konfirmasi destruktif dan peringatan. Varian `success` (emerald) ada di API tetapi bukan untuk submit.
- **Focus:** outline aksen 2px, offset 2px (global). Disabled: opasitas 55%.

### Chips
- **Badge:** label 11px/500, radius 5px, latar wash + teks 700 + ring inset 1px dengan nada slate, blue (aksen), green, amber, red.
- **Filter monitor:** chip 32px bergaris dengan titik status 8px dan hitungan tabular; terpilih = isi slate-900 terbalik (putih di mode gelap).

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** putih (gelap slate-900).
- **Shadow Strategy:** xs, lihat Elevation.
- **Border:** 1px slate-200 (gelap slate-800); header kartu min 48px dengan garis bawah.
- **Internal Padding:** 16px.

### Inputs / Fields
- **Style:** 32px, garis slate-300, putih, radius 6px, teks 13px, placeholder slate-400.
- **Focus:** garis berganti `blue-500` (aksen) dengan ring 3px aksen 20%.
- **Error / Disabled:** garis rose-400 dan pesan rose-600 di bawah field; disabled latar slate-50.

### Navigation
- **Sidebar panel:** 240px putih, grup dengan label 11px slate-400, link 32px radius 6px teks 13px/500. Aktif = latar slate-100 dan ikon berwarna aksen; diam = slate-600 dengan ikon slate-400. Di HP menjadi laci 288px.
- **Tabs:** garis bawah 2px aksen pada tab aktif, teks 13px/500.

### Navigator Soal (signature)
Tile 36px radius 6px, nomor tabular. Kosong = putih dengan garis inset slate-300; dijawab = isi aksen dengan `accent-fg`; ragu = isi amber-300 dengan garis amber-500 dan tanda segitiga sudut 7px; ragu dan dijawab = tambah titik di bawah. Soal aktif = outline 2px slate-900 berjarak 2px. Legenda dan ringkasan tiga angka (Dijawab / Ragu / Kosong) di bawah grid.

### Pill Simpan (signature)
Pill penuh 32px yang selalu menyertakan bukti. Tersimpan = wash emerald dengan titik emerald dan jam sinkron terakhir; menyimpan = slate dengan ikon putar dan jumlah antrean; offline = wash amber dengan ikon awan coret dan jumlah antrean. Klik memicu sinkron ulang.

### Opsi Jawaban
Baris penuh hingga 72ch, radius 8px, padding 12px 16px, bulatan huruf 28px. Terpilih = garis + ring aksen, wash `blue-50`, bulatan berisi aksen.

### Timer
Blok 40px radius 6px, latar slate-100, angka 18px/600 tabular. Di bawah 5 menit berganti ke wash rose dengan ring rose-200.

## Do's and Don'ts

### Do:
- **Do** pakai utilitas `blue-*` atau `var(--accent)` untuk semua aksen, dan `text-accent-fg` untuk teks di atas isi aksen.
- **Do** pakai aksen untuk tile yang dijawab dan untuk tombol "Kumpulkan ujian".
- **Do** sertakan bukti (jam sinkron atau jumlah antrean) setiap kali menampilkan status simpan.
- **Do** bedakan status navigator dengan isi vs garis dan tanda, sehingga terbaca tanpa warna.
- **Do** pakai Inter dengan `tabular-nums` untuk angka; monospace hanya untuk kode, token, dan LaTeX.
- **Do** tampilkan logo, nama, dan tagline tenant di header dan login kedua entry; footer `© DoExam · <versi>` di panel, daftar ujian/hasil, dan login, tidak di ruang ujian.
- **Do** jaga setiap permukaan setara di mode gelap (kanvas slate-950, permukaan slate-900).

### Don't:
- **Don't** pakai hijau untuk "dijawab" atau untuk tombol submit; hijau hanya tersimpan dan sukses.
- **Don't** menambah hue keempat (termasuk nada `purple` di `Badge`).
- **Don't** menulis hex biru atau `text-white` di atas aksen; warna tenant terang akan rusak.
- **Don't** pakai teks 12px atau monospace untuk angka biasa.
- **Don't** mengganti garis 1px dengan bayangan besar atau membesarkan radius di atas 12px.
