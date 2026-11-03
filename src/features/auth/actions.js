"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/server/auth";
import { homePathForRole } from "@/lib/server/auth/session";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/db/schema";
import { isValidUsername, normalizeUsername } from "@/lib/shared/username";
import { loginSchema } from "./schema";

const INVALID_CREDENTIALS = "Username atau password salah.";

function fieldErrorsFrom(error) {
  const fieldErrors = {};

  for (const issue of error.issues) {
    const key = issue.path[0];

    if (key && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }

  return fieldErrors;
}

function authErrorMessage(error) {
  const status = error?.status ?? error?.statusCode;
  const code = error?.body?.code ?? error?.code;

  if (status === 429 || code === "TOO_MANY_REQUESTS") {
    return "Terlalu banyak percobaan masuk. Coba lagi dalam 1 menit.";
  }

  const connectionCodes = new Set([
    "ECONNREFUSED",
    "ETIMEDOUT",
    "ENOTFOUND",
    "PROTOCOL_CONNECTION_LOST",
  ]);
  const pending = [error];
  const seen = new Set();
  while (pending.length) {
    const current = pending.pop();
    if (!current || seen.has(current)) continue;
    seen.add(current);
    if (connectionCodes.has(current.code)) {
      return "Layanan database tidak dapat dihubungi. Hubungi Admin untuk memeriksa MySQL.";
    }
    if (current.cause) pending.push(current.cause);
    if (Array.isArray(current.errors)) pending.push(...current.errors);
  }

  return INVALID_CREDENTIALS;
}

export async function loginAction(prevState, formData) {
  const raw = {
    username: formData.get("username"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      error: null,
      fieldErrors: fieldErrorsFrom(parsed.error),
    };
  }

  const username = normalizeUsername(parsed.data.username);

  if (!isValidUsername(username)) {
    return {
      error: null,
      fieldErrors: {
        username:
          "Username hanya boleh berisi huruf, angka, titik, garis bawah, atau strip.",
      },
    };
  }

  let signedInUser;

  try {
    const result = await auth.api.signInUsername({
      body: {
        username,
        password: parsed.data.password,
      },
      headers: await headers(),
    });

    signedInUser = result.user;
  } catch (error) {
    return {
      error: authErrorMessage(error),
      fieldErrors: {},
    };
  }

  const [user] = await db
    .select({
      id: users.id,
      role: users.role,
      isActive: users.isActive,
    })
    .from(users)
    .where(eq(users.id, signedInUser.id))
    .limit(1);

  if (!user || !user.isActive) {
    try {
      await auth.api.signOut({ headers: await headers() });
    } catch {
      // Sesi mungkin belum terbentuk; tidak perlu menggagalkan respons.
    }

    return {
      error: "Akun Anda tidak aktif. Hubungi Admin.",
      fieldErrors: {},
    };
  }

  redirect(homePathForRole(user.role));
}

export async function logoutAction() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // Tetap arahkan ke halaman login walau sesi sudah tidak valid.
  }

  redirect("/login?reason=logout");
}
