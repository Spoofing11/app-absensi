import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { cn } from "@/lib/shared/cn";

const styles = {
  warning: {
    container: "border-[#d9b36a]/40 bg-[#fff5dc] text-[#7a541b]",
    icon: AlertCircle,
  },
  error: {
    container: "border-danger/20 bg-danger-bg text-danger-text",
    icon: AlertCircle,
  },
  info: {
    container: "border-line-strong/80 bg-surface text-ink-soft",
    icon: Info,
  },
  success: {
    container: "border-[#4f7a5f]/20 bg-[#eaf1eb] text-[#33543d]",
    icon: CheckCircle2,
  },
};

export function Alert({ variant = "info", title, children, className }) {
  const config = styles[variant] ?? styles.info;
  const Icon = config.icon;

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-md border px-4 py-3 text-sm leading-relaxed",
        config.container,
        className,
      )}
    >
      <Icon className="mt-0.5 h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? (
          <div className={cn(title && "mt-0.5", "text-sm leading-relaxed")}>
            {children}
          </div>
        ) : null}
      </div>
    </div>
  );
}
