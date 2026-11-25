// A-07 대리 신고 접수
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ProxyReportForm } from "@/components/admin/reports/proxy-report-form";
import { getAdminContext } from "@/lib/auth/admin";
import { seoulToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import ko from "../../../../../../messages/ko.json";

const t = ko.admin.reports.new;

export default function ProxyReportPage() {
  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-8 md:px-6">
      <Link href="/admin/reports" className="flex min-h-11 items-center gap-1 self-start text-desc text-ink-muted">
        <span aria-hidden>‹</span> {t.back}
      </Link>
      <h1 className="text-page font-bold tracking-[-0.01em] text-ink">{t.title}</h1>
      <Suspense fallback={<span role="status" className="text-desc text-ink-muted">{ko.admin.loading}</span>}>
        <ProxyReport />
      </Suspense>
    </main>
  );
}

async function ProxyReport() {
  const { facility } = await getAdminContext();
  const supabase = await createClient();
  const { data } = await supabase.from("facilities").select("areas").eq("id", facility.id).single();
  // "Today" is the request day in Seoul, the default 분실 기간.
  await connection();
  return <ProxyReportForm areas={data?.areas ?? []} today={seoulToday()} />;
}
