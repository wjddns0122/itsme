import Image from "next/image";
import { cn } from "@/lib/utils";

// SVG icons exported from the Figma file into public/icons. Colors are baked into each file,
// so states use separate files (e.g. "package" and "package-active").
export type IconName =
  | "alert-circle"
  | "chevron-right"
  | "clock"
  | "dashboard"
  | "dashboard-active"
  | "facility-cafe"
  | "facility-festival"
  | "facility-hotel"
  | "facility-school"
  | "facility-ski"
  | "file-text"
  | "file-text-active"
  | "log-out"
  | "package"
  | "package-active"
  | "package-tab-active"
  | "phone"
  | "plus"
  | "search"
  | "settings"
  | "settings-active"
  | "spinner"
  | "user-check"
  | "user-check-active"
  | "user-check-todo";

type IconProps = {
  name: IconName;
  size: 16 | 18 | 20 | 22 | 26;
  className?: string;
};

export function Icon({ name, size, className }: IconProps) {
  return (
    <Image
      src={`/icons/${name}.svg`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      unoptimized
      className={cn("shrink-0", className)}
    />
  );
}
