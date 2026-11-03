import { Loader2 } from "lucide-react";
import { cn } from "@/lib/shared/cn";

const variants = {
  primary:
    "bg-ink text-canvas hover:bg-[#3a2c20] active:bg-[#221a12] disabled:hover:bg-ink",
  secondary:
    "border border-line-strong bg-transparent text-ink hover:bg-surface active:bg-surface-raised",
  ghost: "bg-transparent text-ink-soft hover:bg-surface hover:text-ink",
};

const sizes = {
  md: "h-11 px-4 text-sm",
  lg: "h-14 px-6 text-[12px] font-semibold uppercase tracking-[0.16em]",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  children,
  ...props
}) {
  return (
    <button
      className={cn(
        "group inline-flex items-center justify-center gap-2.5 rounded-md font-sans font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-60",
        variants[variant] ?? variants.primary,
        sizes[size] ?? sizes.md,
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
