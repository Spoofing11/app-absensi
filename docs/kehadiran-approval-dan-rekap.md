# Penempatan, approval, dan rekap foto

## Sebelum menjalankan versi ini

Perubahan kode ini belum dibuild atau diuji. Paket PDFKit perlu dipasang oleh pemilik project.

Di CMD lokal, dari folder project:

```cmd
npm install pdfkit@0.20.2
```

Perintah tersebut menyelaraskan package-lock.json dengan package.json. Ikutkan keduanya saat commit. Jangan push package.json baru tanpa memperbarui lockfile jika deployment menggunakan npm ci.

Migrasi yang disiapkan: `drizzle/0009_project_approvals.sql` beserta journal dan snapshot. Tidak ada migrasi atau perubahan data yang dijalankan oleh agen.

Di VPS, setelah menerima kode dan lockfile terbaru, jalankan satu per satu:

```bash
cd /var/www/app-absensi
npm ci
npm run db:migrate
npm run build
sudo systemctl restart app-absensi
```

Administrator sistem memperoleh akses fitur baru. Role lain perlu diberikan Read untuk Rekap Foto Absensi, atau Read dan Edit (Proses Approval) untuk Approval Absensi melalui Manajemen Role.

## Penempatan

- Penempatan harian mempertahankan aturan satu tukang per tanggal, termasuk tanggal mendatang.
- Penempatan tanpa batas tanggal tersedia untuk pengguna dari role selain Administrator. Satu pengguna dapat mempunyai beberapa project aktif.
- Duplikat pengguna/project yang masih aktif ditolak. Pengaktifan kembali membuat periode baru; periode nonaktif tetap disimpan.
- Bila pengguna mempunyai beberapa project penempatan yang berlaku, pengguna memilih project saat absen masuk. Jika hanya satu project, dipilih otomatis.
- Jadwal tukang berasal dari project yang dipilih; jadwal karyawan/supervisor mengikuti pengaturan role. Tidak ada nama role Supervisor yang ditetapkan khusus di backend.
- Project laporan pekerjaan saat pulang dan catatan operasional disimpan terpisah dari project penempatan saat masuk.

## Approval dan perhitungan

- Absensi baru berstatus Menunggu. Keputusan dapat diberikan setelah absen pulang atau setelah tanggal berganti jika lupa pulang.
- Sudah masuk dihitung satu hari hadir, termasuk Menunggu dan lupa pulang. Ditolak tidak dihitung hadir.
- Popup Review memperlihatkan foto asli masuk/pulang, jam, role, project, dan laporan pekerjaan sebelum keputusan.
- Penolakan wajib disertai alasan. Keputusan hanya dapat diproses sekali; catatan yang telah diproses tidak bisa dikirim ulang dari popup lama.
- Penolakan tidak menghapus foto asli. Rekap dan detail laporan menampilkan No Photo untuk foto pulang yang ditolak; petugas Review tetap dapat memeriksa bukti asli.
- Pergantian hari mengikuti APP_TIMEZONE (Asia/Jakarta). Jam pulang tidak dibuat otomatis. Catatan tanpa absen pulang tetap tersimpan pada hari sebelumnya dan dapat direview kemudian.
- Versi ini memakai batas tanggal kalender: setelah tengah malam user membuka absensi tanggal baru, bukan checkout tanggal sebelumnya.
- Data sebelum migrasi berstatus Data sebelumnya (legacy) dan tetap dihitung seperti sebelumnya. Data lama tidak otomatis menjadi antrean approval.

## Dashboard

- Filter role tidak mencantumkan Administrator.
- Total Pengguna dihitung unik per pengguna/tanggal. Penempatan beberapa project tidak menggandakan total global.
- Kehadiran aktual mengikuti role dan project historis saat absen, bukan master terbaru. Data role lama ditandai tersendiri.
- Untuk pengguna belum absen, daftar ekspektasi mengikuti akun aktif dengan absensi aktif dan penempatan yang berlaku. Tidak ada kalender libur/hari kerja baru dalam perubahan ini.
- Ditolak tidak dimasukkan ke Sudah Masuk, Terlambat, atau Pulang. Total Pengguna tetap merupakan jumlah orang dalam cakupan.

## Rekap Foto Absensi dan PDF

- Halaman /photo-recap hanya membaca data absensi dan ketidakhadiran; tidak menyediakan Create/Edit/Delete.
- Filter dari/sampai tanggal, role, project dan pencarian nama/kode diterapkan ke halaman dan PDF. Rentang maksimal 366 hari, termasuk satu tanggal.
- Tabel dikelompokkan Senin–Minggu. Tanggal di luar filter ditandai; total hanya menghitung tanggal di dalam filter.
- Halaman menampilkan 20 pengguna per halaman. PDF mencakup semua pengguna dalam filter, bukan halaman yang sedang terlihat.
- Batas pemrosesan halaman: 5000 catatan absensi dan 5000 catatan ketidakhadiran. Batas PDF: 1000 catatan setelah filter. Bila terlampaui, persempit filter; data tidak dipotong diam-diam.
- PDF A3 landscape berisi foto dan jam masuk/pulang, role, project, status, dan total. Alasan penolakan lengkap dilampirkan pada halaman tambahan.
- Foto diambil di server dari storage privat setelah pemeriksaan izin. Foto yang hilang/gagal diambil menggunakan No Photo tanpa mengubah jumlah hadir.
- Tidak memerlukan cron untuk pergantian tampilan No Photo; kondisi dihitung dari tanggal/waktu server.
