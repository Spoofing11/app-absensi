# Pemeliharaan Portal Absensi

## Struktur

- `src/app`: routing, metadata, layout, dan pemuatan data halaman.

- `src/features/<fitur>/actions.js`: validasi, transaksi, dan mutasi server.

- `src/features/schedules/resolver.js`: satu sumber penentuan jadwal untuk tampilan dan check-in.

- `src/features/schedules/timing.js`: konversi jam lokal, keterlambatan, dan shift malam.

- `src/features/attendance/queries.js`: catatan tanggal kerja hari ini atau shift malam yang masih terbuka dari hari sebelumnya.

- `src/components/admin`: navigasi dan komponen pengelolaan bersama.

- `src/components/app`: kerangka pekerja, stylesheet bersama, loading, dan error.

- `src/lib/server/auth/permissions.js`: pemeriksaan izin di backend.

- `src/lib/shared/permissions.js`: daftar fitur dan izin CRUD.

- `src/lib/server/db/schema`: skema Drizzle; `drizzle/`: migrasi berurutan.

## Hak akses

Role akses (`users.role_id`) terpisah dari jenis pekerja (`employee_type`: `karyawan`, `tukang`, `none`). Menu mengikuti izin Read; Server Action tetap memeriksa izin operasinya. Fitur `schedules` memakai izin CRUD sendiri. Admin sistem mendapat seluruh izin pengelolaan, dilindungi dari edit/hapus, dan tidak melakukan absensi. Role terpakai tidak dapat dihapus.

## Sumber jadwal

- Karyawan: jadwal default Role.

- Tukang: jadwal Project pada penempatan aktif; jika Project tidak memilih jadwal, gunakan jadwal Role.

- Admin/jenis `none`: tanpa absensi.

- Field jadwal di form User dihapus. `users.work_schedule_id` lama dipertahankan di database untuk audit tetapi tidak dipakai lagi oleh resolver atau penyimpanan User.

- Jadwal yang dipilih secara eksplisit tetapi nonaktif tidak diganti diam-diam oleh jadwal lain; Admin harus memperbaikinya.

- Jadwal belum tersedia atau penempatan belum aktif: check-in diblokir dengan penjelasan.

- Jam pulang lebih awal dari jam masuk berarti berakhir pada hari berikutnya. Jam masuk dan pulang identik ditolak saat membuat/mengedit jadwal.

- Kalender hari kerja, hari libur, dan beberapa shift per project tidak termasuk fitur ini.

Nama/kode jadwal, jam terjadwal, timezone, nama pengguna, role lama, dan project disalin ketika check-in. Perubahan Role/Project/jadwal tidak mengubah snapshot absensi lama. Dashboard menampilkan snapshot untuk catatan yang sudah check-in; check-out melengkapi catatan yang sama. Shift malam terbuka dari tanggal kerja sebelumnya tetap bisa diselesaikan setelah tengah malam.

Jadwal yang masih dipilih oleh Role/Project tidak dapat dinonaktifkan sebelum referensinya dilepas. Foreign key melindungi penghapusan jadwal yang digunakan Role, Project, atau catatan absensi.

## Penempatan

Form hanya memilih Tukang dan Project. Penempatan berlaku langsung tanpa batas tanggal. `created_at` adalah waktu pencatatan dan tidak diubah saat penugasan diganti. Satu Tukang maksimal memiliki satu penempatan aktif, dilindungi lock baris User dan unique generated column `active_worker_id`.

Mengganti Project/penerima mengakhiri baris lama dan membuat baris baru; notifikasi dibuat dalam transaksi yang sama. Menyimpan pilihan yang sama tidak membuat riwayat/notifikasi ganda. Tombol Akhiri menghentikan status aktif dan mengisi waktu akhir otomatis, tanpa menghapus baris, notifikasi, atau riwayat absensi. Tombol ini memakai izin Delete penempatan. Penempatan yang diakhiri tidak dapat diedit kembali; buat penempatan baru bila perlu.

Kolom tanggal lama tetap disimpan sebagai data historis, tetapi tidak lagi dibaca oleh logika aplikasi atau ditampilkan sebagai isian.

## Migrasi

Jalankan `npm run db:migrate` sebelum memakai versi aplikasi ini. Jangan reset database atau memakai push skema pada data aktif.

Migrasi 0003:

1. Menambah relasi jadwal Role dan Project serta status penempatan.

2. Memetakan jadwal User lama menjadi default Role hanya jika ada tepat satu pilihan jadwal aktif yang berbeda pada Role tersebut. Role dengan jadwal beragam harus dikonfigurasi Admin; tidak dipilih secara acak. Kolom jadwal User tidak dihapus.

3. Dari penempatan lama yang tanggalnya masih berlaku saat migrasi, memilih yang paling baru dicatat untuk setiap Tukang sebagai aktif. Baris lainnya dipertahankan sebagai riwayat nonaktif. Penggunaan tanggal ini hanya untuk konversi data lama; operasi aplikasi berikutnya sepenuhnya memakai status.

Cadangan pemetaan sebelum migrasi tersedia di `storage/backups/`, diabaikan Git. Cadangan tersebut bukan pengganti backup database lengkap untuk deployment berikutnya. Untuk database baru: migrasi dahulu, lalu `npm run db:seed`.

## Notifikasi

`src/features/notifications` menyediakan lonceng Tukang. Pesan hanya menyebut project, tanpa logika tanggal tugas. Detail memakai salinan nama/alamat saat dibuat. Daftar, detail, dan status dibaca dibatasi ke penerima dari sesi login. Lonceng memuat ulang setiap 30 detik saat halaman terlihat dan menampilkan 50 pesan terakhir. Jumlah belum dibaca dan tandai semua dibaca menghitung seluruh pesan pengguna tersebut.

## Verifikasi

- `npm test`: tes unit waktu, timezone, keterlambatan, dan shift malam.

- `npm run test:integration`: tes MySQL dengan sesi QA yang dimock; memeriksa resolver aktual, transaksi penempatan, konkurensi, notifikasi, CRUD jadwal, izin backend, snapshot, dan check-out. Data/foto QA dibersihkan setelah tes. Jalankan pada database pengujian atau salinan lokal, bukan database produksi.

- `npm run lint` dan `npm run build`.

- Tes browser membutuhkan server lokal yang aktif. Script `worker-ui-smoke.mjs`, `access-smoke.mjs`, dan `notifications-smoke.mjs` memakai fixture jadwal Role dan penempatan berstatus. Penghapusan fixture QA setelah tes terpisah dari tombol Akhiri di aplikasi.

## Riwayat, snapshot Role, dan pulang lebih awal

Migrasi 0004 hanya menambah kolom dan indeks. Snapshot Role lama tidak dipetakan ke Role pengguna saat ini karena identitas historis tersebut tidak dapat dipastikan. Catatan lama memakai grup `Data lama · <kategori role lama>`. Check-in baru menyimpan ID dan nama Role; penggantian atau penghapusan Role tidak mengubah grup historis. Perubahan nama Role menghasilkan kelompok nama historis terpisah, meskipun identitas Role sama.

`/history` menyediakan riwayat dan rekap dengan izin `history.read`, filter tanggal (maksimal 366 hari), Role historis, Project, status, pencarian literal nama/kode, dan pagination 25 baris. Grup yang ditampilkan mengikuti halaman aktif; jumlah catatan/pengguna pada judul grup dihitung dari seluruh hasil filter. Rekap menghitung hari hadir unik per pengguna/grup, hari terlambat, total keterlambatan, catatan belum check-out, jumlah pulang awal, dan selisih kehadiran lengkap. Selisih kehadiran bukan jam kerja bersih atau lembur. Tidak ada inferensi Tidak Hadir, Izin, Sakit, atau Cuti dari ketiadaan catatan.

Foto diakses melalui `/api/attendance-photo/<attendanceId>/<in|out>`, dengan pemeriksaan sesi aktif dan `history.read` pada setiap permintaan. Metadata harus milik pengguna pada catatan, storage key tidak dikirim ke browser, path dibatasi ke storage root, dan respons memakai `private, no-store` serta `nosniff`. Jangan menaruh folder storage di public.

Keterlambatan pada dashboard memakai `late_seconds` dari waktu check-in tersimpan, bukan jam yang terus bertambah. Durasi ditampilkan dalam menit (dibulatkan ke atas untuk sisa detik), dengan format jam/menit untuk durasi panjang.

Check-out sebelum `scheduled_end_at` snapshot wajib kategori alasan (Sakit, Keperluan pribadi, Izin atasan, Lainnya) dan keterangan 5–1000 karakter. Backend menggunakan waktunya sendiri dan memvalidasi ulang dalam transaksi. Tepat atau setelah jam selesai tidak membutuhkan alasan; alasan yang dikirim pada kondisi tersebut diabaikan. Aturan mengikuti tanggal penuh snapshot untuk shift malam. Catatan lama tanpa alasan tidak ditulis ulang. Jam pada browser hanya membantu tampilan field, bukan menentukan validitas.

`node scripts/history-ui-smoke.mjs` memeriksa peringatan terlambat, form wajib pulang awal, check-out setelah jadwal tanpa alasan, riwayat/detail/rekap, serta ukuran layar 360–1920 dengan kamera simulasi dan data QA sementara. Script tidak menyalakan server; localhost:3000 harus sudah aktif.

## Toggle absensi, Profil, dan riwayat pribadi (migrasi 0005)

Pembaruan ini disiapkan sebagai perubahan kode saja. Tidak ada build, lint, test, atau migrasi database yang dijalankan oleh agen pada tahap ini.

Sebelum menjalankan aplikasi versi ini, jalankan sendiri `npm run db:migrate`, lalu `npm run build`. Migrasi 0005 menambahkan `users.attendance_enabled` default aktif untuk User baru. Akun lama dengan jenis `none` atau kategori Administrator dimigrasikan nonaktif untuk mempertahankan perilakunya. Data pengguna, media, serta absensi tidak dihapus. Entri izin `attendance` lama dihapus karena absensi pribadi bukan lagi izin Role. Snapshot Drizzle dan journal disertakan; jangan menjalankan SQL migrasi secara manual di luar runner jika ingin journal tetap konsisten.

Absensi diperiksa melalui `src/lib/shared/attendance-access.js` dan `src/lib/server/auth/attendance.js`: akun aktif, toggle aktif, dan jenis Karyawan/Tukang. Hak pengelolaan tetap berasal dari Role. Manager tidak dikenali dari nama Role; pilih Role pengelolaan, aktifkan toggle, dan pilih jenis pekerja di User. Jadwal dan syarat penempatan Tukang tetap berlaku. Ketika toggle dimatikan, fitur check-in/check-out ditutup tetapi riwayat pribadi tetap dapat dibaca oleh pemilik akun.

Form User baru menyalakan toggle secara default; form Edit menggunakan nilai database. Mematikan toggle menyimpan jenis `none`; ketika diaktifkan lagi, operator memilih jenis pekerja yang berlaku. Role sistem tetap dilindungi dari perubahan Role/nonaktif akun. Akun sendiri tidak boleh mengganti Role melalui form User, tetapi informasi profil dan toggle dapat dikelola sesuai izin User Edit.

`src/lib/shared/password.js` menjadi sumber ketentuan password baru: 12–128 karakter, minimal satu huruf besar, huruf kecil, angka, dan simbol selain spasi. Login pengguna lama tidak dipaksa memenuhi aturan password baru. Pembuatan User, penggantian oleh pengelola, dan penggantian melalui Profil memeriksa aturan yang sama. Penggantian oleh pengelola juga mencabut seluruh sesi target.

Menu avatar pada header Admin dan pekerja menyediakan Profil/Keluar. `/profile` hanya mengubah akun dari sesi login, bukan ID User kiriman browser. Nama maksimal 150 karakter. Foto JPG/PNG/WebP maksimal 5 MB diolah ulang oleh Sharp menjadi JPEG persegi 512 piksel, dengan batas piksel sumber. Media lama tidak dihapus otomatis; file historis dipertahankan. Foto profil dilayani lewat endpoint privat yang memeriksa kepemilikan dan ID foto aktif. Batas body Server Action dinaikkan menjadi 6 MB untuk menampung unggahan beserta multipart overhead.

Ganti password tanpa password lama hanya diperbolehkan pada sesi login yang dibuat dalam 15 menit terakhir. Sesi lebih lama diminta masuk ulang. Password baru dan konfirmasinya harus cocok; hash diperbarui bersama `password_changed_at` dan pencabutan seluruh sesi dalam satu transaksi. Cookie lama tidak memberi akses setelah sesi dicabut. Setelah berhasil pengguna diarahkan ke login, bukan reset database.

`PersonalHistory` memuat 10 catatan per halaman menggunakan ID User dari sesi; tidak memakai izin Riwayat Admin dan tidak menerima ID User dari URL. Filter tanggal dan pagination memakai parameter `personalFrom`, `personalTo`, `personalPage`. Role dan alasan tetap berasal dari snapshot setiap catatan. Riwayat seluruh pengguna dan akses foto absensi tetap memerlukan `history.read`.

Sebelum dipakai, operator perlu menjalankan sendiri build dan pemeriksaan yang diperlukan, termasuk alur toggle, unggah foto, sesi password baru, serta riwayat pribadi lintas akun.

## Penempatan per tanggal (0006)

Penempatan baru berisi tanggal kerja, project, dan 1–100 tukang. Tidak ada status Draft/Terbitkan atau proses Akhiri. Satu tukang hanya boleh satu project per tanggal, dijaga oleh transaksi dengan lock user dan unique index `(worker_id, work_date)`. Penyimpanan beberapa tukang bersifat atomik: jika satu bentrok, seluruh batch dibatalkan.

Daftar dikelompokkan tanggal lalu project, dengan filter tanggal/project/pencarian dan pagination tujuh kelompok tanggal. Penempatan yang pernah direferensikan absensi tidak boleh diedit/dihapus. Penempatan lain dapat diubah/dihapus sesuai izin role. Notifikasi terkait diperbarui atau dihapus dalam transaksi yang sama.

Dashboard dan check-in memilih penempatan sesuai tanggal kerja `APP_TIMEZONE`. Check-out tetap memakai snapshot check-in, termasuk shift lintas tengah malam. Dashboard menampilkan hingga tujuh penempatan mendatang. Notifikasi menampilkan tanggal penempatan agar jadwal mendatang tidak tertukar dengan hari ini.

Migrasi `drizzle/0006_daily_project_assignments.sql` belum dijalankan. Jalankan `npm run db:migrate` sendiri sebelum menggunakan kode baru. Migrasi memetakan penempatan lama yang masih aktif ke tanggal saat migrasi dijalankan pada zona WIB (+07:00, sesuai konfigurasi aplikasi saat ini). Jika deployment memakai zona waktu lain, sesuaikan offset SQL sebelum migrasi. Penempatan lama yang sudah diakhiri tetap menjadi arsip dengan `work_date = NULL`; tanggal kerja tidak ditebak dari tanggal pembuatan. Arsip tidak ikut resolver absensi dan tidak bisa diedit/dihapus melalui UI. Relasi dan snapshot absensi lama dipertahankan. PM perlu menyiapkan penempatan untuk hari-hari berikutnya karena penempatan tidak lagi berlanjut otomatis.

Kolom lama `start_date`, `end_date`, `ended_at` dipertahankan hanya untuk audit data historis. Kolom generated `active_worker_id` beserta unique index lama dan `is_active` dihapus, diganti aturan per tanggal. Tidak ada tabel baru. Jangan menjalankan versi aplikasi lama setelah migrasi ini.

Sesuai permintaan pemilik, perubahan ini hanya berupa kode dan berkas migrasi; build, testing, dan migrasi database tidak dijalankan oleh agen.



## Durasi notifikasi sukses

Pesan sukses User, Role, Jadwal Kerja, Project, Penempatan, Profil, dan Absensi menggunakan `src/components/ui/useTimedNotice.js`. Pesan otomatis hilang setelah 5 detik, tanpa refresh. Setiap keberhasilan baru memulai ulang hitungan, termasuk jika teks pesannya sama. Timer dibersihkan ketika komponen dilepas. Durasi bersama diatur melalui `NOTICE_DURATION_MS`. Pesan error dan informasi tetap tidak ditutup otomatis. Tidak ada perubahan database.


## Ringkasan penempatan

Halaman Penempatan membuka tab Hari Ini secara default. Tab Mendatang mengurutkan tanggal terdekat lebih dahulu; Riwayat mengurutkan tanggal terbaru dan menyimpan arsip lama tanpa tanggal di bagian akhir. Angka pada tab menghitung kelompok project per tanggal. Setiap tanggal dapat dibuka/ditutup dan menyediakan pintasan tambah dengan tanggal terisi. Project ditampilkan sebagai baris ringkas pada desktop dan kartu pada ponsel. Lihat Detail membuka seluruh anggota tim project tersebut, beserta status absensi dan aksi sesuai izin. Pencarian nama tukang menampilkan project yang berisi tukang tersebut, dengan jumlah dan detail tim tetap lengkap. Status belum absen tidak berarti alpa. Status masuk/pulang berasal dari absensi yang terkait dengan ID penempatan dan tanggal kerja yang sama; penempatan yang pernah dipakai tetap terkunci meskipun merupakan data lama. Sesudah menyimpan, tab dan filter diarahkan ke tanggal yang disimpan. Perubahan tampilan ini tidak memerlukan migrasi database. Build dan testing tidak dijalankan sesuai instruksi pemilik.
