"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { UserRound, LogOut } from "lucide-react";
import { logoutAction } from "@/features/auth/actions";
function Avatar({ user }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="avatar account-avatar">
      {user.profilePhotoId && !failed ? (
        <Image
          src={`/api/profile-photo/${user.profilePhotoId}`}
          alt=""
          width={38}
          height={38}
          unoptimized
          onError={() => setFailed(true)}
        />
      ) : (
        user.name.slice(0, 1)
      )}
    </span>
  );
}
export default function AccountMenu({ user }) {
  const menu = useRef(null);
  useEffect(() => {
    const close = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "keydown" || !menu.current?.contains(event.target)) {
        menu.current?.removeAttribute("open");
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <details className="account-menu" ref={menu}>
      <summary aria-label={`Menu akun ${user.name}`}>
        <Avatar key={user.profilePhotoId || "initial"} user={user} />
        <span className="account-menu-name">{user.name}</span>
      </summary>
      <div className="account-dropdown">
        <p>
          <strong>{user.name}</strong>
          <small>@{user.username}</small>
        </p>
        <Link
          href="/profile"
          onClick={() => menu.current?.removeAttribute("open")}
        >
          <UserRound size={17} />
          Profil
        </Link>
        <form action={logoutAction}>
          <button type="submit">
            <LogOut size={17} />
            Keluar
          </button>
        </form>
      </div>
    </details>
  );
}
