import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { db } from "@/lib/server/db";
import {
  accounts,
  sessions,
  users,
  verifications,
} from "@/lib/server/db/schema";
import { env } from "@/lib/server/env";
import { normalizeUsername, USERNAME_PATTERN } from "@/lib/shared/username";

export const auth = betterAuth({
  appName: "Portal Absensi",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [...new Set([env.APP_BASE_URL, env.BETTER_AUTH_URL])],

  database: drizzleAdapter(db, {
    provider: "mysql",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
    usePlural: false,
  }),

  user: {
    additionalFields: {
      userCode: {
        type: "string",
        required: false,
        input: false,
      },
      role: {
        type: "string",
        required: false,
        input: false,
        defaultValue: "karyawan",
      },
      attendanceEnabled: {
        type: "boolean",
        required: false,
        input: false,
        defaultValue: true,
      },
      isActive: {
        type: "boolean",
        required: false,
        input: false,
        defaultValue: true,
      },
      workScheduleId: {
        type: "string",
        required: false,
        input: false,
      },
      phoneNumber: {
        type: "string",
        required: false,
        input: false,
      },
      passwordChangedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // Selalu cek sesi ke database; jangan andalkan cache cookie.
    cookieCache: {
      enabled: false,
    },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 20,
    customRules: {
      "/sign-in/username": {
        window: 60,
        max: 5,
      },
    },
  },

  advanced: {
    database: {
      generateId: "uuid",
    },
    defaultCookieAttributes: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
    },
  },

  plugins: [
    username({
      minUsernameLength: 3,
      maxUsernameLength: 50,
      usernameNormalization: (value) => normalizeUsername(value),
      usernameValidator: (value) => USERNAME_PATTERN.test(value),
      validationOrder: {
        username: "post-normalization",
      },
    }),
    // nextCookies harus menjadi plugin terakhir.
    nextCookies(),
  ],
});
