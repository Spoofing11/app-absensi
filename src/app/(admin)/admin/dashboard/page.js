import Link from "next/link";
import { requireWorkspace } from "@/lib/server/auth/permissions";
import { FEATURES } from "@/lib/shared/permissions";
export default async function Page() {
  const { user, permissions } = await requireWorkspace();
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE / DASHBOARD</p>
          <h1>Selamat datang, {user.name}.</h1>
          <p>Pilih fitur yang ingin Anda kelola.</p>
        </div>
      </div>
      <div className="dashboard-links">
        {Object.entries(FEATURES)
          .filter(([key]) => key !== "attendance" && permissions[key]?.read)
          .map(([key, label]) => (
            <Link className="dashboard-link" href={`/${key}`} key={key}>
              <h2>{label}</h2>
              <p>Buka {label.toLowerCase()}</p>
            </Link>
          ))}
      </div>
    </>
  );
}
