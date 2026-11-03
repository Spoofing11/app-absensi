import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "./env";

const root = path.resolve(env.STORAGE_ROOT);
const minio = env.STORAGE_DRIVER === "minio" ? new S3Client({
  endpoint: env.MINIO_ENDPOINT,
  region: env.MINIO_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY_ID,
    secretAccessKey: env.MINIO_SECRET_ACCESS_KEY,
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
}) : null;

function objectRef(key) {
  if (!/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\.jpg$/.test(key)) {
    throw new Error("Kunci foto tidak valid.");
  }
  return { Bucket: env.MINIO_BUCKET, Key: key };
}

export async function storePhoto(key, data) {
  const ref = objectRef(key);
  if (minio) {
    await minio.send(new PutObjectCommand({ ...ref, Body: data, ContentType: "image/jpeg" }));
    return;
  }
  await mkdir(root, { recursive: true });
  await writeFile(path.join(root, key), data, { flag: "wx" });
}

export async function readPhoto(key) {
  const ref = objectRef(key);
  if (!minio) return readFile(path.join(root, key));
  const { Body } = await minio.send(new GetObjectCommand(ref));
  if (!Body) throw new Error("Isi foto tidak tersedia.");
  return Buffer.from(await Body.transformToByteArray());
}

export async function deletePhoto(key) {
  const ref = objectRef(key);
  if (minio) {
    await minio.send(new DeleteObjectCommand(ref));
    return;
  }
  await unlink(path.join(root, key));
}
