---
version: 1
slug: "src"
primary_target: "src"
related_targets: ["src/exam","src/app","src/shared"]
---

# Surface: seluruh client DoExam (exam client /exam/ + panel staf /app/)

Mode: Operate. Build path: code-led. Redesign penuh di atas standar kategori (canon dipilih pengguna).

Audiens & tugas: peserta mengerjakan ujian (tenang, tidak kehilangan jawaban); staf menjalankan hari ujian, menyusun soal, mengoreksi. Prioritas setara: ruang ujian, monitor proktor, bank soal & editor, login & daftar ujian. Hindari: terlalu ramai/bergaya, terlalu kaku/birokratis. Panel: padat tapi lega dibaca.

Tolok ukur: Linear, Stripe Dashboard, Vercel/shadcn.

## Direction contract

THESIS: Standar kategori dieksekusi pada tingkat Linear/Stripe: putih, slate, satu aksen milik institusi. Menolak versi setengah jadi kategori ini: kartu bulat besar di mana-mana, teks 12px, biru generik yang bukan milik siapa pun.

OWN-WORLD: Latar slate-50 (gelap: slate-950), permukaan putih bergaris 1px slate-200, radius 8px kontrol / 12px panel, bayangan halus berjarak. Satu aksen = primary_color tenant (default biru #2563eb) dipakai untuk aksi utama, seleksi, fokus. Status: hijau tersimpan/dijawab, amber ragu/peringatan, merah kritis. Inter Variable, angka tabular untuk timer, token, tabel. Body 13–14px, judul halaman 20–22px semibold.

STORY: Peserta langsung tahu soal ke berapa, sisa waktu, dan bahwa jawabannya aman. Staf menemukan menu, data, dan aksi utama dalam hitungan detik.

FIRST VIEWPORT: Ruang ujian: header putih 64px (logo + nama institusi + ujian kiri; status simpan pill + timer tabular kanan), kartu soal lebar di kiri dengan opsi baris bergaris dan bulatan huruf, panel navigasi nomor 5 kolom di kanan, tombol Sebelumnya / Ragu-ragu / Berikutnya di dasar kartu. Panel staf: sidebar kiri 240px ala Linear, konten tabel/form padat di kanan.

FORM: canon (standar kategori), dipilih pengguna dari hand pertama. seed:48a3524413b63cbd

Signature: status simpan selalu disertai bukti (jam sinkron terakhir + jumlah antrean); navigator nomor dengan status terbaca tanpa warna (isi, garis, tanda).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
