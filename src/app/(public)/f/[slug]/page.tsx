// P-02 시설 페이지
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icon";
import { DeskInfo } from "@/components/public/desk-info";
import { FacilityLoadError, FacilityLoading, FacilityNotFound } from "@/components/public/facility-states";
import { PublicShell } from "@/components/public/public-shell";
import { RememberFacility } from "@/components/public/remember-facility";
import { FACILITY_TYPE_ICON } from "@/lib/facilities/public";
import { loadFacility } from "@/lib/facilities/load";
import ko from "../../../../../messages/ko.json";

const t = ko.public.facility;

export async function generateMetadata({ params }: PageProps<"/f/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadFacility(slug);
  if (result.status !== "ok") return { title: t.notFoundTitle, robots: { index: false, follow: false } };

  const { facility, listed } = result.data;
  return {
    title: t.metaTitle.replace("{name}", facility.name),
    description: facility.intro ?? t.metaDescription.replace("{name}", facility.name),
    // Search engines only for facilities that agreed to be listed (Q19).
    robots: listed ? undefined : { index: false, follow: false },
  };
}

export default function FacilityPage({ params }: PageProps<"/f/[slug]">) {
  return (
    <PublicShell footer={ko.public.footer}>
      <Suspense fallback={<FacilityLoading />}>
        <FacilityContent params={params} />
      </Suspense>
    </PublicShell>
  );
}

async function FacilityContent({ params }: Pick<PageProps<"/f/[slug]">, "params">) {
  const { slug } = await params;
  const result = await loadFacility(slug);
  if (result.status === "not_found") return <FacilityNotFound />;
  if (result.status === "error") return <FacilityLoadError retryHref={`/f/${slug}`} />;

  const { facility } = result.data;
  const meta = [facility.region, ko.facilityTypes[facility.type]].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <RememberFacility facility={facility} />

      <section className="flex flex-col gap-2">
        <div className="flex items-end justify-between">
          <span className="flex size-12 items-center justify-center rounded-ui-sm bg-blush">
            <Icon name={FACILITY_TYPE_ICON[facility.type]} size={26} />
          </span>
          <Image src="/brand/mascot-main.png" alt="" width={96} height={74} priority className="h-[74px] w-24 object-contain" />
        </div>
        <h1 className="text-question font-bold tracking-[-0.02em] text-ink">{facility.name}</h1>
        <p className="text-desc text-ink-muted">{meta}</p>
        {facility.intro ? <p className="text-body text-ink">{facility.intro}</p> : null}
      </section>

      <Link
        href={`/f/${facility.slug}/report`}
        className="flex h-15 items-center justify-center rounded-ui-lg bg-brand text-button-lg font-bold text-on-brand"
      >
        {t.lost}
      </Link>
      <Link
        href={`/f/${facility.slug}/found`}
        className="flex h-15 items-center justify-center rounded-ui-lg border-[1.5px] border-line-strong bg-surface text-button-lg font-bold text-ink"
      >
        {t.found}
      </Link>
      <p className="text-desc text-ink-muted">{t.alreadyReported}</p>

      <DeskInfo facility={facility} labels={{ desk: t.desk, contact: t.contact, hours: t.hours }} />
    </div>
  );
}
