import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi."),
  APP_TIMEZONE: z.string().min(1).default("Asia/Jakarta"),
  APP_BASE_URL: z.string().url("APP_BASE_URL harus berupa URL."),
  BETTER_AUTH_URL: z.string().url("BETTER_AUTH_URL harus berupa URL."),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET minimal 32 karakter."),
  STORAGE_DRIVER: z.enum(["local", "minio"]).default("local"),
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_BUCKET: z.string().min(1).default("composite-absensi"),
  MINIO_REGION: z.string().min(1).default("us-east-1"),
  MINIO_ACCESS_KEY_ID: z.string().optional(),
  MINIO_SECRET_ACCESS_KEY: z.string().optional(),
  STORAGE_ROOT: z.string().min(1).default("./storage"),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
}).superRefine((config, context) => {
  if (config.STORAGE_DRIVER !== "minio") return;
  let endpoint;
  try {
    endpoint = new URL(config.MINIO_ENDPOINT || "");
  } catch {
    // Validation below reports the field without exposing its value.
  }
  if (!endpoint || !["http:", "https:"].includes(endpoint.protocol) ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      endpoint.pathname !== "/") {
    context.addIssue({ code: "custom", path: ["MINIO_ENDPOINT"],
      message: "Isi URL API MinIO, tanpa nama bucket atau kredensial." });
  }
  for (const key of ["MINIO_ACCESS_KEY_ID", "MINIO_SECRET_ACCESS_KEY"]) {
    if (!config[key]?.trim()) {
      context.addIssue({ code: "custom", path: [key], message: "Wajib diisi saat memakai MinIO." });
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Konfigurasi environment tidak valid:",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error(
    "Konfigurasi environment belum lengkap. Periksa .env.local.",
  );
}

export const env = parsed.data;
