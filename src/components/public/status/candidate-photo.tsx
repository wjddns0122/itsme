"use client";

import Image from "next/image";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";

/**
 * P-04 후보 카드의 대표 사진 (ADR-030). The signed URL lasts 10 minutes and the page does not
 * refresh once candidates are in, so a failed load falls back to the category icon.
 */
export function CandidatePhoto({ url, alt, icon }: { url: string | null; alt: string; icon: IconName }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span className="flex size-11 shrink-0 items-center justify-center rounded-ui-sm bg-blush">
        <Icon name={icon} size={24} />
      </span>
    );
  }
  return (
    <span className="relative size-16 shrink-0 overflow-hidden rounded-ui-sm bg-blush">
      <Image src={url} alt={alt} fill unoptimized className="object-cover" onError={() => setFailed(true)} />
    </span>
  );
}
