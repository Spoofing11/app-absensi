import Image from "next/image";

/**
 * Satu foto dipakai untuk dua komposisi:
 * - mobile: hero pendek di atas bottom sheet;
 * - desktop: panel editorial 55% di kiri.
 */
export function AuthShell({ children }) {
  return (
    <div className="min-h-svh bg-canvas lg:grid lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
      <section className="relative h-[clamp(200px,28svh,300px)] overflow-hidden bg-[#1c1611] lg:h-auto lg:min-h-svh">
        <Image
          src="/images/login/studio.png"
          alt=""
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover object-[center_68%] lg:object-center"
        />

        <div
          className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-transparent lg:from-[#14100c]/85 lg:via-[#14100c]/35 lg:to-[#14100c]/95"
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-canvas to-transparent lg:hidden"
          aria-hidden="true"
        />

        {/* Mobile header */}
        <div className="relative z-10 flex items-start justify-between px-6 pt-[calc(1rem+env(safe-area-inset-top))] lg:hidden">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/45 px-3 py-1.5 backdrop-blur-md">
            <span
              className="h-1.5 w-1.5 rounded-full bg-[#f0b49a]"
              aria-hidden="true"
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
              Portal Absensi
            </span>
          </span>
          <span className="inline-flex items-center rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/85 backdrop-blur-md">
            Internal
          </span>
        </div>

        {/* Desktop editorial panel */}
        <div className="relative z-10 hidden h-full flex-col justify-between p-10 lg:flex xl:p-16">
          <div className="flex items-center justify-between gap-6">
            <span className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-black/30 px-3.5 py-1.5 backdrop-blur-md">
              <span
                className="h-1.5 w-1.5 rounded-full bg-[#e5bfa1]"
                aria-hidden="true"
              />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/90">
                Composite Interior · Tangerang
              </span>
            </span>
          </div>

          <div className="max-w-xl">
            <div className="border-t border-white/15 pt-5">
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                PT Composite Interior Prima
              </p>
              <p className="mt-1 text-sm text-white/60">
                Sistem absensi internal
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="relative -mt-8 flex min-h-0 flex-col rounded-t-[24px] border-t border-line/70 bg-canvas px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-7 sm:px-8 lg:mt-0 lg:min-h-svh lg:rounded-none lg:border-t-0 lg:px-12 lg:py-10 xl:px-20">
        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center">
          {children}
        </div>

        <footer className="mx-auto mt-10 flex w-full max-w-[420px] flex-col gap-2 border-t border-line pt-5 text-[11px] text-ink-soft sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} PT Composite Interior Prima</p>
          <p className="text-ink-muted">Akses internal</p>
        </footer>
      </main>
    </div>
  );
}
