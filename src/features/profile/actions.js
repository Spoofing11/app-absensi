"use server";
import { recordActivity, recordSessionActivity } from "@/features/activity-logs/server";
import { randomUUID } from "node:crypto";
import { storePhoto, deletePhoto } from "@/lib/server/photo-storage";
import sharp from "sharp";
import { and, eq, ne } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { users, mediaFiles, accounts, sessions } from "@/lib/server/db/schema";
import { requireUser } from "@/lib/server/auth/session";
import { auth } from "@/lib/server/auth";
import { hashPassword } from "better-auth/crypto";
import { passwordError } from "@/lib/shared/password";
import { isValidUsername, normalizeUsername } from "@/lib/shared/username";
export async function saveOwnProfile(previous, form) {
  const user = await requireUser();
  const name = String(form.get("name") || "").trim();
  if (!name || name.length > 150)
    return { error: "Nama wajib diisi dan maksimal 150 karakter." };
  const rawUsername = form.get("username");
  if (typeof rawUsername !== "string" || !isValidUsername(rawUsername))
    return { error: "Username harus 3–50 karakter. Gunakan huruf, angka, titik, garis bawah, atau tanda hubung." };
  const username = normalizeUsername(rawUsername);
  const photo = form.get("photo");
  let outputFile;
  let committed = false;
  let stage = "database";
  try {
    const [duplicate] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.username, username), ne(users.id, user.id)))
      .limit(1);
    if (duplicate) return { error: "Username sudah digunakan." };
    let metadata = null;
    if (photo && typeof photo !== "string" && photo.size > 0) {
      if (
        photo.size > 5 * 1024 * 1024 ||
        !["image/jpeg", "image/png", "image/webp"].includes(photo.type)
      )
        return { error: "Gunakan foto JPG, PNG, atau WebP maksimal 5 MB." };
      stage = "image";
      const image = await sharp(Buffer.from(await photo.arrayBuffer()), {
        limitInputPixels: 25000000,
        animated: false,
      })
        .rotate()
        .resize(512, 512, { fit: "cover" })
        .jpeg({ quality: 85 })
        .toBuffer({ resolveWithObject: true });
      const id = randomUUID();
      const storageKey = `${id}.jpg`;
      stage = "storage";
      await storePhoto(storageKey, image.data);
      outputFile = storageKey;
      metadata = {
        id,
        ownerUserId: user.id,
        purpose: "profile",
        storageKey,
        mimeType: "image/jpeg",
        sizeBytes: image.data.length,
        widthPx: image.info.width,
        heightPx: image.info.height,
        createdById: user.id,
      };
    }
    stage = "database";
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: users.id, isActive: users.isActive })
        .from(users)
        .where(eq(users.id, user.id))
        .for("update");
      if (!current?.isActive) throw new Error("inactive");
      if (metadata) await tx.insert(mediaFiles).values(metadata);
      await tx
        .update(users)
        .set({
          name,
          username,
          displayUsername: username,
          updatedById: user.id,
          ...(metadata
            ? {
                profilePhotoId: metadata.id,
                image: `/api/profile-photo/${metadata.id}`,
              }
            : {}),
        })
        .where(eq(users.id, user.id));
      await recordActivity(tx, user, "profile", "edit", `Profil @${username} diperbarui`);
    });
    committed = true;
  } catch (error) {
    if (outputFile && !committed) await deletePhoto(outputFile).catch(() => {});
    if (error?.code === "ER_DUP_ENTRY" || error?.cause?.code === "ER_DUP_ENTRY")
      return { error: "Username sudah digunakan." };
    // Log only diagnostic codes, never SQL, credentials, or uploaded contents.
    console.error("[profile-save]", {
      stage,
      code: String(error?.cause?.code || error?.code || error?.name || "UnknownError").slice(0, 100),
      status: error?.$metadata?.httpStatusCode,
    });
    if (stage === "image")
      return { error: "Foto tidak dapat diproses. Coba simpan ulang sebagai JPG atau PNG, lalu unggah kembali." };
    if (stage === "storage")
      return { error: "Foto belum dapat diunggah ke penyimpanan. Hubungi Admin untuk memeriksa konfigurasi storage." };
    return {
      error:
        "Profil belum dapat disimpan. Periksa foto dan koneksi, lalu coba lagi.",
    };
  }
  revalidatePath("/", "layout");
  return { success: "Profil berhasil diperbarui." };
}
export async function changeOwnPassword(previous, form) {
  const user = await requireUser();
  const password = form.get("password");
  const message = passwordError(password);
  if (message) return { error: message };
  if (password !== form.get("confirmation"))
    return { error: "Konfirmasi password tidak sama." };
  const context = await auth.api.getSession({ headers: await headers() });
  if (context?.user?.id !== user.id || !context?.session?.token)
    return { error: "Sesi tidak tersedia. Silakan masuk ulang.", reauth: true };
  const hashed = await hashPassword(password);
  try {
    await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .for("update");
      if (!current?.isActive) throw new Error("inactive");
      const [session] = await tx
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.userId, user.id),
            eq(sessions.token, context.session.token),
          ),
        )
        .for("update");
      if (
        !session ||
        session.expiresAt <= new Date() ||
        Date.now() - session.createdAt.getTime() > 15 * 60 * 1000 ||
        session.createdAt.getTime() - Date.now() > 30000
      )
        throw new Error("fresh-session-required");
      const [credential] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(
          and(
            eq(accounts.userId, user.id),
            eq(accounts.providerId, "credential"),
          ),
        )
        .for("update");
      if (!credential) throw new Error("credential-missing");
      await tx
        .update(accounts)
        .set({ password: hashed })
        .where(eq(accounts.id, credential.id));
      await tx
        .update(users)
        .set({ passwordChangedAt: new Date(), updatedById: user.id })
        .where(eq(users.id, user.id));
      await tx.delete(sessions).where(eq(sessions.userId, user.id));
      await recordActivity(tx, user, "profile", "password", "Password akun diperbarui.");
    });
  } catch (error) {
    if (error.message === "fresh-session-required")
      return {
        error:
          "Untuk keamanan, masuk ulang lalu ganti password dalam 15 menit setelah login.",
        reauth: true,
      };
    return { error: "Password belum dapat diubah. Silakan coba lagi." };
  }
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    /* Sessions were already revoked transactionally. */
  }
  redirect("/login?reason=password-changed");
}
export async function reauthenticateForPasswordChange() {
  const user = await requireUser();
  try {
    await auth.api.signOut({ headers: await headers() });
    await recordSessionActivity(user, "logout", "Keluar untuk masuk ulang.");
  } catch {}
  redirect("/login?reason=reauth");
}
