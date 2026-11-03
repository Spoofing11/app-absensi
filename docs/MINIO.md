Buat bucket privat composite-absensi dan access key khusus dengan izin s3:GetObject, s3:PutObject, dan s3:DeleteObject pada arn:aws:s3:::composite-absensi/*. Isi konfigurasi berikut di .env.local atau environment proses VPS, bersama DATABASE_URL, APP_BASE_URL, BETTER_AUTH_URL, dan BETTER_AUTH_SECRET yang sudah dipakai aplikasi.

```dotenv
STORAGE_DRIVER=minio
MINIO_ENDPOINT=https://minio.example.com
MINIO_BUCKET=composite-absensi
MINIO_REGION=us-east-1
MINIO_ACCESS_KEY_ID=
MINIO_SECRET_ACCESS_KEY=
```

Gunakan URL API S3 MinIO, bukan URL konsol. Sesuaikan region dengan konfigurasi server. Jangan simpan kredensial di Git. Untuk pengembangan lokal gunakan STORAGE_DRIVER=local atau hapus variabel tersebut untuk memakai pengaturan bawaan.

SDK S3 sudah tercatat di package.json dan package-lock.json. Gunakan npm ci untuk memasang dependensi dari lockfile. Setelah konfigurasi VPS siap, jalankan npm run build dan npm run start. Jika database VPS belum memakai skema terbaru, jalankan npm run db:migrate sebelum menjalankan aplikasi.

Jika memindahkan data lama, salin foto dari STORAGE_ROOT ke root bucket dengan nama objek yang sama sebelum mengganti driver. Aplikasi memakai storageKey yang sudah tercatat di database. Foto tetap dibaca melalui route aplikasi yang memeriksa sesi dan izin. Penggantian driver ini tidak memerlukan perubahan skema database.
