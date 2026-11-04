"use client";
import { useTimedNotice } from "@/components/ui/useTimedNotice";
import Image from "next/image";
import { useActionState, useEffect, useState } from "react";
import {
  saveOwnProfile,
  changeOwnPassword,
  reauthenticateForPasswordChange,
} from "./actions";
import PasswordRules from "@/components/ui/PasswordRules";
import { PASSWORD_LENGTH, passwordError } from "@/lib/shared/password";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
export default function ProfileForms({ user }) {
  const [notice, setNotice] = useTimedNotice();
  const [profile, profileAction, profilePending] = useActionState(
    async (previous, form) => {
      setNotice("");
      const result = await saveOwnProfile(previous, form);
      if (result?.success) setNotice(result.success);
      return result;
    },
    {},
  );
  const [security, passwordAction, passwordPending] = useActionState(
    changeOwnPassword,
    {},
  );
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [preview, setPreview] = useState("");
  const [fileError, setFileError] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  function choosePhoto(event) {
    const file = event.target.files?.[0];
    setFileError("");
    if (!file) {
      setPreview("");
      return;
    }
    if (
      file.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    ) {
      setFileError("Gunakan foto JPG, PNG, atau WebP maksimal 5 MB.");
      event.target.value = "";
      setPreview("");
      return;
    }
    setImageFailed(false);
    setPreview(URL.createObjectURL(file));
  }
  const photo =
    preview ||
    (user.profilePhotoId ? `/api/profile-photo/${user.profilePhotoId}` : "");
  return (
    <div className="profile-grid">
      <section className="content-card">
        <h2>Informasi Profil</h2>
        <p className="worker-help">
          Ubah nama dan foto yang tampil pada akun Anda.
        </p>
        <form action={profileAction} className="profile-form">
          <div className="profile-photo-preview">
            {photo && !imageFailed ? (
              <Image
                src={photo}
                width={112}
                height={112}
                unoptimized
                alt="Foto profil Anda"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <span>{user.name.slice(0, 1)}</span>
            )}
          </div>
          <label>
            Foto profil
            <input
              type="file"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              onChange={choosePhoto}
            />
            <small>JPG, PNG, WebP. Maksimal 5 MB. Foto dipotong persegi.</small>
          </label>
          {fileError && <Alert variant="error">{fileError}</Alert>}
          <label>
            Nama lengkap
            <input
              name="name"
              defaultValue={user.name}
              required
              maxLength={150}
              autoComplete="name"
            />
          </label>
          <label>
            Username
            <input value={user.username} disabled readOnly />
          </label>
          {profile.error && <Alert variant="error">{profile.error}</Alert>}
          {notice && <Alert variant="success">{notice}</Alert>}
          <Button type="submit" loading={profilePending} disabled={!!fileError}>
            Simpan Profil
          </Button>
        </form>
      </section>
      <section className="content-card">
        <h2>Ubah Password</h2>
        <p className="worker-help">
          Tidak memerlukan password lama. Untuk keamanan, perubahan hanya
          tersedia dalam 15 menit setelah login. Setelah berhasil, semua
          perangkat akan logout.
        </p>
        <form action={passwordAction} className="profile-form">
          <label>
            Password baru
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={PASSWORD_LENGTH}
              maxLength={PASSWORD_LENGTH}
              autoComplete="new-password"
              placeholder="Tepat 8 karakter"
            />
            <PasswordRules value={password} />
          </label>
          <label>
            Konfirmasi password baru
            <input
              type="password"
              name="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              required
              maxLength={PASSWORD_LENGTH}
              autoComplete="new-password"
            />
            {confirmation && confirmation !== password && (
              <span className="field-error" role="alert">
                Konfirmasi password tidak sama.
              </span>
            )}
          </label>
          {security.error && <Alert variant="error">{security.error}</Alert>}
          <Button
            type="submit"
            loading={passwordPending}
            disabled={!!passwordError(password) || password !== confirmation}
          >
            Ubah Password dan Logout
          </Button>
        </form>
        {security.reauth && (
          <form action={reauthenticateForPasswordChange} className="mt-4">
            <Button variant="secondary">Masuk Ulang</Button>
          </form>
        )}
      </section>
    </div>
  );
}
