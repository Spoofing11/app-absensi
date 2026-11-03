"use client";
import Link from "next/link";
import "./workspace.css";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
export default function WorkspaceError({ reset }) {
  return (
    <section className="content-card">
      <Alert variant="error" title="Halaman belum dapat dimuat">
        Periksa koneksi Anda, lalu coba kembali. Jika masalah berlanjut, hubungi
        Admin.
      </Alert>
      <div className="flex flex-wrap gap-3 mt-5">
        <Button onClick={reset}>Coba Lagi</Button>
        <Link className="admin-button secondary" href="/dashboard">
          Kembali ke Dashboard
        </Link>
      </div>
    </section>
  );
}
