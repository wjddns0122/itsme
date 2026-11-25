// P-06 습득물 맡기는 방법 (Figma에 시안 없음: P-02의 부품과 docs/03-screens.md P-06 문구로 만든다)
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { DeskInfo } from "@/components/public/desk-info";
import { FacilityLoadError, FacilityLoading, FacilityNotFound } from "@/components/public/facility-states";
import { PublicShell } from "@/components/public/public-shell";
import { deskInfoRows } from "@/lib/facilities/page-data";
import { loadFacility } from "@/lib/facilities/load";
import ko from "../../../../../../messages/ko.json";

const t = ko.public.found;

export async function generateMetadata({ params }: PageProps<"/f/[slug]/found">): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadFacility(slug);
  if (result.status !== "ok") return { title: ko.public.facility.notFoundTitle, robots: { index: false, follow: false } };
  return {
    title: t.metaTitle.replace("{name}", result.data.facility.name),
    robots: result.data.listed ? undefined : { index: false, follow: false },
  };
}

export default function FoundItemGuidePage({ params }: PageProps<"/f/[slug]/found">) {
  return (
    <PublicShell footer={ko.public.footer}>
      <Suspense fallback={<FacilityLoading />}>
        <FoundGuide params={params} />
      </Suspense>
    </PublicShell>
  );
}

async function FoundGuide({ params }: Pick<PageProps<"/f/[slug]/found">, "params">) {
  const { slug } = await params;
  const result = await loadFacility(slug);
  if (result.status === "not_found") return <FacilityNotFound />;
  if (result.status === "error") return <FacilityLoadError retryHref={`/f/${slug}/found`} />;

  const { facility } = result.data;
  const hasDeskInfo = deskInfoRows(facility).length > 0;

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col items-center gap-2 pt-4 text-center">
        <Image src="/brand/mascot-main.png" alt="" width={130} height={100} priority className="h-[100px] w-[130px] object-contain" />
        <p className="text-caption font-medium text-ink-muted">{facility.name}</p>
        <h1 className="text-question font-bold tracking-[-0.02em] text-ink">{t.title}</h1>
        <p className="text-body text-ink">{t.body}</p>
      </section>

      {hasDeskInfo ? (
        <DeskInfo facility={facility} labels={{ desk: t.dropOff, contact: t.contact, hours: t.hours }} />
      ) : (
        <p className="rounded-ui-md border border-line bg-surface p-3.5 text-desc text-ink-muted">{t.noDeskInfo}</p>
      )}

      <Link
        href={`/f/${facility.slug}`}
        className="flex h-11 items-center justify-center rounded-ui-sm border border-line-strong bg-surface text-button font-bold text-ink"
      >
        {t.back}
      </Link>
    </div>
  );
}
