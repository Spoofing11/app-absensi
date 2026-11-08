"use client";
import Image from "next/image";
import { useState } from "react";
export default function RecapPhoto({ id, kind, available }) {
  const [failed, setFailed] = useState(false);
  const src =
    available && !failed
      ? `/api/attendance-photo/${id}/${kind}`
      : "/images/no-photo.svg";
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={kind === "in" ? "Lihat foto masuk" : "Lihat foto pulang"}
    >
      <Image
        src={src}
        width={70}
        height={82}
        alt={kind === "in" ? "Foto masuk" : "Foto pulang"}
        unoptimized
        onError={() => setFailed(true)}
        className="recap-photo"
      />
    </a>
  );
}
