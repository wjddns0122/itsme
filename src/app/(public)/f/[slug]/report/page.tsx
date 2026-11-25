// P-03 분실 신고
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { FacilityLoadError, FacilityLoading, FacilityNotFound } from "@/components/public/facility-states";
import { PublicShell } from "@/components/public/public-shell";
import { ReportForm } from "@/components/public/report/report-form";
import { seoulToday } from "@/lib/dates";
import { loadFacility } from "@/lib/facilities/load";
import ko from "../../../../../../messages/ko.json";

export async function generateMetadata({ params }: PageProps<"/f/[slug]/report">): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadFacility(slug);
  const title = result.status === "ok" ? ko.public.report.metaTitle.replace("{name}", result.data.facility.name) : ko.public.facility.notFoundTitle;
  // A form, not content: keep it out of search engines.
  return { title, robots: { index: false, follow: false } };
}

export default function ReportPage({ params }: PageProps<"/f/[slug]/report">) {
  return (
    <PublicShell
      topRight={
        <Suspense fallback={null}>
          <FacilityName params={params} />
        </Suspense>
      }
    >
      <Suspense fallback={<FacilityLoading />}>
        <ReportFormForFacility params={params} />
      </Suspense>
    </PublicShell>
  );
}

async function FacilityName({ params }: Pick<PageProps<"/f/[slug]/report">, "params">) {
  const { slug } = await params;
  const result = await loadFacility(slug);
  return result.status === "ok" ? result.data.facility.name : null;
}

async function ReportFormForFacility({ params }: Pick<PageProps<"/f/[slug]/report">, "params">) {
  const { slug } = await params;
  const result = await loadFacility(slug);
  if (result.status === "not_found") return <FacilityNotFound />;
  if (result.status === "error") return <FacilityLoadError retryHref={`/f/${slug}/report`} />;

  const { facility } = result.data;
  // "Today" must be the request day, not the build day.
  await connection();
  return <ReportForm slug={facility.slug} areas={facility.areas} today={seoulToday()} />;
}
