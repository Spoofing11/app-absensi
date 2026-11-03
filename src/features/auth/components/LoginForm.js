"use client";

import { useActionState } from "react";
import { ArrowRight, UserRound } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";
import { loginAction } from "@/features/auth/actions";

const initialState = {
  error: null,
  fieldErrors: {},
};

export function LoginForm({ notice = null }) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    initialState,
  );

  const fieldErrors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {notice ? <Alert variant="info">{notice}</Alert> : null}

      {state?.error ? <Alert variant="error">{state.error}</Alert> : null}

      <TextField
        id="username"
        name="username"
        label="Username"
        icon={UserRound}
        placeholder="Masukkan username"
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="next"
        required
        error={fieldErrors.username}
      />

      <PasswordField
        id="password"
        name="password"
        placeholder="Masukkan password"
        autoComplete="current-password"
        enterKeyHint="go"
        required
        error={fieldErrors.password}
      />

      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={pending}
        aria-label={pending ? "Sedang memproses masuk" : "Masuk"}
      >
        {pending ? "Memproses…" : "Masuk"}
        {!pending ? (
          <ArrowRight
            className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        ) : null}
      </Button>

      <p className="text-center text-xs leading-relaxed text-ink-soft">
        Akun dibuat oleh Admin. Lupa password?{" "}
        <span className="font-semibold text-ink">Hubungi Admin.</span>
      </p>
    </form>
  );
}
