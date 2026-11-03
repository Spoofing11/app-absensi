import Link from "next/link";
import WorkerShell from "@/components/app/WorkerShell";
import ProfileForms from "@/features/profile/ProfileForms";
import { requireUser, homePathForRole } from "@/lib/server/auth/session";
import { permissionsFor } from "@/lib/server/auth/permissions";
export const metadata = { title: "Profil Saya" };
export default async function Page() {
  const user = await requireUser();
  const permissions = await permissionsFor(user);
  const canManage = Object.values(permissions).some((p) => p.read);
  return (
    <WorkerShell user={user} canManage={canManage}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">AKUN / PROFIL</p>
          <h1>Profil Saya</h1>
          <p>Kelola informasi dan keamanan akun Anda.</p>
        </div>
        <Link
          className="admin-button secondary"
          href={homePathForRole(user.role)}
        >
          Kembali ke Dashboard
        </Link>
      </div>
      <ProfileForms
        user={{
          name: user.name,
          username: user.username,
          profilePhotoId: user.profilePhotoId,
        }}
      />
    </WorkerShell>
  );
}
