import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import "@/components/app/workspace.css";
export default function Page() {
  return (
    <div className="admin-shell">
      <main className="access-denied-page">
        <Logo size={42} />
        <section className="content-card">
          <ShieldAlert size={30} className="muted mb-5" />
          <p className="eyebrow">HAK AKSES</p>
          <h1>Akses tidak tersedia</h1>
          <p>
            Anda belum memiliki izin untuk menggunakan fitur ini. Hubungi Admin
            jika Anda memerlukan akses tambahan.
          </p>
          <Link className="admin-button" href="/dashboard">
            Kembali ke Dashboard
          </Link>
        </section>
      </main>
    </div>
  );
}
