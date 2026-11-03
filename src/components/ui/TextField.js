import { cn } from "@/lib/shared/cn";

export function TextField({
  id,
  label,
  icon: Icon,
  error,
  hint,
  className,
  inputClassName,
  ...props
}) {
  const describedBy =
    [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;

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
        {Icon ? (
          <Icon
            className="pointer-events-none absolute left-4 h-5 w-5 text-ink-muted"
            aria-hidden="true"
          />
        ) : null}

        <input
          id={id}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={describedBy}
          className={cn(
            "h-14 w-full rounded-md bg-transparent px-4 text-base text-ink placeholder:text-ink-muted/75 focus-visible:outline-none",
            Icon && "pl-12",
            inputClassName,
          )}
          {...props}
        />
      </div>

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
