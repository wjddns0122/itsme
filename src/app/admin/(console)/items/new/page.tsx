// A-03 습득물 등록
import { connection } from "next/server";
import { RegisterItem } from "@/components/admin/register/register-item";
import { getAdminContext } from "@/lib/auth/admin";
import { seoulNowLocalInput } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export default async function NewItemPage() {
  const { facility } = await getAdminContext();
  const supabase = await createClient();
  const { data } = await supabase.from("facilities").select("areas").eq("id", facility.id).single();
  // "Now" is the request time, the default for 습득 일시.
  await connection();
  return <RegisterItem facilityId={facility.id} areas={data?.areas ?? []} nowLocal={seoulNowLocalInput()} />;
}
