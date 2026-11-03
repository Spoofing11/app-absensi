# Portal Absensi Composite

Aplikasi Next.js dengan MySQL dan penyimpanan foto privat. Siapkan Node.js 20.9 atau lebih baru dan npm.

## Pengembangan lokal

Gunakan .env.example sebagai acuan untuk .env.local. Jika sudah punya .env.local, tambahkan hanya pengaturan yang diperlukan. Isi DATABASE_URL dengan database lokal dan BETTER_AUTH_SECRET dengan secret acak minimal 32 karakter. Pertahankan STORAGE_DRIVER=local untuk menyimpan foto di folder storage.

```bash
npm ci
npm run db:migrate
npm run dev
```

Buka http://localhost:3000.

## Deploy dari GitHub ke VPS

1. Commit kode, folder drizzle, package.json, package-lock.json, dan .env.example. Periksa daftar file sebelum push. Kredensial dan foto lokal berada di luar repo.
2. Clone repo di VPS atau tarik perubahan terbaru pada checkout yang sudah ada.
3. Buat .env.local di VPS berdasarkan .env.example. Isi koneksi MySQL dan secret login VPS. Set APP_BASE_URL dan BETTER_AUTH_URL ke URL HTTPS aplikasi yang sama.
4. Set STORAGE_DRIVER=minio dan lengkapi konfigurasi bucket privat composite-absensi. Jika membawa database lokal ke VPS, salin foto lama dengan nama objek yang sama terlebih dahulu. Lihat [panduan MinIO](docs/MINIO.md).
5. Jalankan perintah berikut dari root project. Jika VPS sudah memakai pengelola proses, gunakan konfigurasi yang ada untuk menjalankan npm run start.

```bash
npm ci
npm run db:migrate
npm run build
npm run start
```

Setelah aplikasi berjalan, cek login, unggah foto profil, dan absen masuk/pulang dari browser melalui domain HTTPS VPS.
