// A-08 시설 설정·QR (QR은 FL-071, P1)
import { Suspense } from "react";
import { SettingsForm } from "@/components/admin/settings/settings-form";
import { getAdminContext } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import ko from "../../../../../messages/ko.json";

const t = ko.admin.settings;

export default function SettingsPage() {
  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-8 md:px-6">
      <h1 className="text-page font-bold tracking-[-0.01em] text-ink">{t.title}</h1>
      <Suspense fallback={<span role="status" className="text-desc text-ink-muted">{ko.admin.loading}</span>}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  const { userId, facility } = await getAdminContext();
  const supabase = await createClient();
  const [{ data: f, error }, { data: member }] = await Promise.all([
    supabase.from("facilities").select("*").eq("id", facility.id).single(),
    supabase.from("facility_members").select("role").eq("facility_id", facility.id).eq("user_id", userId).maybeSingle(),
  ]);
  if (error || !f) return <p role="alert" className="text-body font-bold text-ink">{t.loadError}</p>;

  return (
    <SettingsForm
      slug={f.slug}
      canEdit={member?.role === "owner"}
      initial={{
        name: f.name,
        type: f.type,
        region: f.region,
        address: f.address,
        contactPhone: f.contact_phone,
        homepageUrl: f.homepage_url,
        intro: f.intro,
        hours: f.hours,
        deskLocation: f.desk_location,
        pickupGuide: f.pickup_guide,
        transferDays: f.transfer_days,
        areas: f.areas,
        isListed: f.is_listed,
      }}
    />
  );
}
