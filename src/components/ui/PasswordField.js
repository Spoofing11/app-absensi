"use client";

import { useState } from "react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/shared/cn";

export function PasswordField({
  id,
  label = "Password",
  error,
  hint,
  className,
  inputClassName,
  ...props
}) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

  function syncCapsLock(event) {
    if (typeof event.getModifierState === "function") {
      setCapsLock(event.getModifierState("CapsLock"));
    }
  }

  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={id}
        className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft"
      >
        {label}
      </label>

      <div
        className={cn(
          "relative flex items-center rounded-md border bg-canvas-raised transition-[border-color,box-shadow] duration-200 focus-within:ring-2",
          error
            ? "border-danger focus-within:border-danger focus-within:ring-danger/10"
            : "border-line-strong focus-within:border-ink focus-within:ring-ink/10",
        )}
      >
        <LockKeyhole
          className="pointer-events-none absolute left-4 h-5 w-5 text-ink-muted"
          aria-hidden="true"
        />

        <input
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-14 w-full rounded-md bg-transparent py-0 pl-12 pr-14 text-base text-ink placeholder:text-ink-muted/75 focus-visible:outline-none",
            inputClassName,
          )}
          onKeyDown={syncCapsLock}
          onKeyUp={syncCapsLock}
          onBlur={() => setCapsLock(false)}
          {...props}
        />

        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Sembunyikan password" : "Tampilkan password"}
          aria-pressed={visible}
          className="absolute right-1.5 inline-flex h-11 w-11 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
        >
          {visible ? (
            <EyeOff className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Eye className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {capsLock && !error ? (
        <p className="text-xs font-medium text-bronze" role="status">
          Caps Lock aktif.
        </p>
      ) : null}

      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs leading-relaxed text-ink-soft">
          {hint}
        </p>
      ) : null}

      {error ? (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs font-medium leading-relaxed text-danger"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
