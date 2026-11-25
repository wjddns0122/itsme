// P-04 [신고 내용 보완하기]
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { FacilityLoading } from "@/components/public/facility-states";
import { PublicShell } from "@/components/public/public-shell";
import { ImproveForm } from "@/components/public/status/improve-form";
import { ReportTokenSchema } from "@/lib/reports/view";
import { createAdminClient } from "@/lib/supabase/admin";
import { COLORS, type Color } from "@/lib/validation/constants";
import { TIMES_OF_DAY, type TimeOfDay } from "@/lib/validation/report";
import ko from "../../../../../../messages/ko.json";

const t = ko.public.edit;

export const metadata: Metadata = {
  title: t.metaTitle,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ImproveReportPage({ params }: PageProps<"/r/[token]/edit">) {
  return (
    <PublicShell>
      <Suspense fallback={<FacilityLoading />}>
        <Improve params={params} />
      </Suspense>
    </PublicShell>
  );
}

async function Improve({ params }: Pick<PageProps<"/r/[token]/edit">, "params">) {
  const { token } = await params;
  if (!ReportTokenSchema.safeParse(token).success) return <Message token={null} text={ko.public.status.notFound} />;
  // The person's own report, opened by its secret token: only the fields they typed themselves.
  const { data: report } = await createAdminClient()
    .from("lost_reports")
    .select("description, colors, brand, lost_time_of_day, status")
    .eq("access_token", token)
    .maybeSingle();
  if (!report) return <Message token={null} text={ko.public.status.notFound} />;
  if (report.status !== "open") return <Message token={token} text={t.notEditable} />;

  return (
    <div className="flex flex-col gap-3.5">
      <h1 className="text-question leading-[1.3] font-bold tracking-[-0.02em] text-ink">{t.title}</h1>
      <p className="text-desc text-ink-muted">{t.hint}</p>
      <ImproveForm
        token={token}
        initial={{
          description: report.description,
          colors: report.colors.filter((c): c is Color => (COLORS as readonly string[]).includes(c)),
          brand: report.brand,
          lostTimeOfDay: (TIMES_OF_DAY as readonly string[]).includes(report.lost_time_of_day ?? "") ? (report.lost_time_of_day as TimeOfDay) : null,
        }}
      />
    </div>
  );
}

function Message({ token, text }: { token: string | null; text: string }) {
  return (
    <section role="alert" className="flex flex-col items-center gap-3 pt-20 text-center">
      <p className="text-section font-bold text-ink">{text}</p>
      <Link href={token ? `/r/${token}` : "/"} className="flex h-11 items-center rounded-ui-sm border border-line-strong bg-surface px-4 text-button font-bold text-ink">
        {token ? t.back : ko.public.status.searchAgain}
      </Link>
    </section>
  );
}
