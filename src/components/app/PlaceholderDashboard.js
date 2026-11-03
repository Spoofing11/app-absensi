import { Logo } from "@/components/brand/Logo";
import { LogoutButton } from "@/components/auth/LogoutButton";

export function PlaceholderDashboard({
  user,
  eyebrow,
  title,
  description,
  note = "Halaman ini masih berupa placeholder. Modul absensi dan riwayat akan dibangun pada milestone berikutnya.",
}) {
  return (
    <div className="min-h-svh bg-canvas">
      <header className="border-b border-line/80 bg-canvas/90">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Logo size={34} />
            <div className="min-w-0 leading-tight">
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                Portal Absensi
              </p>
              <p className="truncate text-sm font-semibold text-ink">
                PT Composite Interior Prima
              </p>
            </div>
          </div>

          <LogoutButton className="w-auto shrink-0 px-3.5" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-bronze">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-2xl font-display text-[clamp(2rem,5vw,3rem)] leading-[1.08] tracking-[-0.015em] text-ink">
          {title}
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-relaxed text-ink-soft">
          {description}
        </p>

        <section className="mt-10 rounded-lg border border-line bg-canvas-raised p-6 shadow-soft sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">
                Akun
              </p>
              <p className="mt-1 truncate text-lg font-semibold text-ink">
                {user.name}
              </p>
              <p className="mt-0.5 truncate text-sm text-ink-soft">
                @{user.username} · {user.userCode}
              </p>
            </div>

            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-line-strong bg-surface px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#5c7a5f]"
                aria-hidden="true"
              />
              {user.role}
            </span>
          </div>

          <p className="mt-6 border-t border-line pt-5 text-sm leading-relaxed text-ink-soft">
            {note}
          </p>
        </section>
      </main>
    </div>
  );
}
