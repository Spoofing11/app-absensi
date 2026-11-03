"use client";
import { PASSWORD_HINT, passwordError } from "@/lib/shared/password";
export default function PasswordRules({ value = "", optional = false }) {
  const message = value ? passwordError(value) : "";
  return (
    <span className="password-guidance">
      <small>
        {PASSWORD_HINT}
        {optional ? " Kosongkan jika tidak ingin mengubah password." : ""}
      </small>
      {message && (
        <span role="alert" className="field-error">
          {message}
        </span>
      )}
    </span>
  );
}
