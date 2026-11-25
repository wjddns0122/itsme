// A-03 습득물 등록
import { connection } from "next/server";
import { Suspense } from "react";
import { RegisterItem } from "@/components/admin/register/register-item";
import { getAdminContext } from "@/lib/auth/admin";
import { seoulNowLocalInput } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import ko from "../../../../../../messages/ko.json";

export default function NewItemPage() {
  return (
    <Suspense fallback={<span role="status" className="px-4 pt-6 text-desc text-ink-muted md:px-6">{ko.admin.loading}</span>}>
      <NewItem />
    </Suspense>
  );
}

async function NewItem() {
  const { facility } = await getAdminContext();
  const supabase = await createClient();
  const { data } = await supabase.from("facilities").select("areas").eq("id", facility.id).single();
  // "Now" is the request time, the default for 습득 일시.
  await connection();
  return <RegisterItem facilityId={facility.id} areas={data?.areas ?? []} nowLocal={seoulNowLocalInput()} />;
}
