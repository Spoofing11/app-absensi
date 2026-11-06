import InstallApp from "@/components/pwa/InstallApp";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { BrandLockup } from "@/components/auth/BrandLockup";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { getSessionUser, homePathForRole } from "@/lib/server/auth/session";

export const metadata = {
  title: "Masuk",
  robots: {
    index: false,
    follow: false,
  },
};

const notices = {
  "password-changed":
    "Password berhasil diperbarui. Silakan masuk dengan password terbaru.",
  reauth: "Silakan masuk ulang, lalu buka Profil untuk mengganti password.",
  expired: "Sesi Anda berakhir. Silakan masuk kembali.",
  inactive: "Akun Anda tidak aktif. Hubungi Admin.",
  logout: "Anda telah keluar.",
};

export default async function LoginPage({ searchParams }) {
  const user = await getSessionUser();

  if (user?.isActive) {
    redirect(homePathForRole(user.role));
  }

  const params = await searchParams;
  const notice = notices[params?.reason] ?? null;

  return (
    <AuthShell>
      <BrandLockup />

      <div className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bronze">
          Selamat datang
        </p>
        <h1 className="mt-3 font-display text-[clamp(1.9rem,4vw,2.5rem)] leading-[1.06] tracking-[-0.015em] text-ink">
          PT Composite Interior Prima
        </h1>
      </div>

      <LoginForm notice={notice} />
      <InstallApp />
    </AuthShell>
  );
}
