import Image from "next/image";
import { cn } from "@/lib/shared/cn";

export function Logo({ size = 48, className, blendBackground = false }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md",
        blendBackground ? "mix-blend-multiply" : "bg-white",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/images/Composite-Logo-Peanut.webp"
        alt=""
        fill
        sizes={`${Math.ceil(size * 2.2)}px`}
        // The supplied artwork has wide white margins around the centered logo.
        style={{ objectFit: "contain", transform: "scale(2.2)" }}
      />
    </span>
  );
}
