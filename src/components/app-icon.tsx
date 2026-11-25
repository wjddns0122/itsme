import Image from "next/image";
import { cn } from "@/lib/utils";

const SIZES = {
  lg: { px: 40, className: "size-10 rounded-app-icon-lg" },
  md: { px: 30, className: "size-[30px] rounded-app-icon-md" },
  sm: { px: 26, className: "size-[26px] rounded-app-icon-sm" },
} as const;

/** The 잇츠미 app icon (Figma "app-icon"). Decorative: the brand name always sits next to it. */
export function AppIcon({ size, className }: { size: keyof typeof SIZES; className?: string }) {
  const s = SIZES[size];
  return (
    <Image
      src="/brand/app-icon.png"
      alt=""
      width={s.px}
      height={s.px}
      className={cn("shrink-0 object-cover", s.className, className)}
    />
  );
}
