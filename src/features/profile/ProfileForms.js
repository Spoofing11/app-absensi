"use client";
import { useTimedNotice } from "@/components/ui/useTimedNotice";
import { useActionState, useRef, useState } from "react";
import ProfilePhotoPicker from "./ProfilePhotoPicker";
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
  const selectedPhoto = useRef(null);
  const [profile, profileAction, profilePending] = useActionState(
    async (previous, form) => {
      setNotice("");
      if (selectedPhoto.current) form.set("photo", selectedPhoto.current);
      const result = await saveOwnProfile(previous, form);
      if (result?.success) {
        selectedPhoto.current = null;
        setNotice(result.success);
      }
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
  return (
    <div className="profile-grid">
      <section className="content-card">
        <h2>Informasi Profil</h2>
        <p className="worker-help">Ubah nama, username, dan foto akun Anda.</p>
        <form action={profileAction} className="profile-form">
          <ProfilePhotoPicker
            photo={
              user.profilePhotoId
                ? `/api/profile-photo/${user.profilePhotoId}`
                : ""
            }
            name={user.name}
            disabled={profilePending}
            onChange={(file) => {
              selectedPhoto.current = file;
            }}
          />
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
            <input
              key={user.username}
              name="username"
              defaultValue={user.username}
              required
              minLength={3}
              maxLength={50}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
            />
            <small>Username baru digunakan saat login berikutnya.</small>
          </label>
          {profile.error && <Alert variant="error">{profile.error}</Alert>}
          {notice && <Alert variant="success">{notice}</Alert>}
          <Button type="submit" loading={profilePending}>
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
