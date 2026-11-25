// pnpm db:seed -- --project-ref <ref> — demo facilities and one admin per facility
// (FL-003, docs/04-architecture.md §11). Example names only, never real businesses (ADR-028).
// Needs NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_ADMIN_PASSWORD in .env.local.
//
// Safety, because the MVP has one shared Supabase project:
// - --project-ref must name the project in NEXT_PUBLIC_SUPABASE_URL (local URLs need no flag).
// - Existing facilities are never overwritten. Admins are linked only to facilities that still
//   carry the seed's own example name, so a real facility that reuses a slug is left alone.
// - Running again resets the demo admins' password to SEED_ADMIN_PASSWORD.
import { parseArgs } from "node:util";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../src/lib/supabase/types";

type FacilityInsert = Database["public"]["Tables"]["facilities"]["Insert"];

const env = z
  .object({
    NEXT_PUBLIC_SUPABASE_URL: z.url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    SEED_ADMIN_PASSWORD: z.string().min(10, "SEED_ADMIN_PASSWORD must be at least 10 characters"),
  })
  .parse(process.env);

const FACILITIES: FacilityInsert[] = [
  {
    slug: "pc-ski",
    name: "평창 ○○ 스키장 (예시)",
    type: "ski_resort",
    region: "강원 평창군",
    address: "강원 평창군 대관령면 (예시 주소)",
    intro: "리프트·렌탈샵·스키하우스에서 주운 물건을 안내데스크에서 보관해요.",
    areas: ["리프트 A", "리프트 B", "곤돌라 탑승장", "렌탈샵", "스키하우스 1층", "주차장"],
    desk_location: "스키하우스 1층 안내데스크",
    hours: "매일 08:00–22:00",
    pickup_guide: "신분증을 가지고 안내데스크로 오세요.",
    transfer_days: 365,
    is_listed: true,
  },
  {
    slug: "univ-demo",
    name: "○○대학교 학생지원센터 (예시)",
    type: "school",
    region: "서울 노원구",
    address: "서울 노원구 (예시 주소)",
    intro: "강의실·도서관·학생회관에서 주운 물건을 학생지원센터에서 보관해요.",
    areas: ["도서관", "학생회관", "1층 로비", "3층 강의실", "체육관"],
    desk_location: "본관 1층 학생지원센터",
    hours: "평일 09:00–18:00",
    pickup_guide: "학생증이나 신분증을 가지고 오세요.",
    transfer_days: 30,
    is_listed: true,
  },
  {
    slug: "gn-resort",
    name: "강릉 ○○ 리조트 (예시)",
    type: "hotel",
    region: "강원 강릉시",
    address: "강원 강릉시 (예시 주소)",
    intro: "객실과 부대시설에서 주운 물건을 프런트에서 보관해요.",
    areas: ["로비", "객실", "수영장", "사우나", "연회장", "주차장"],
    desk_location: "1층 프런트",
    hours: "24시간",
    pickup_guide: "예약자 이름과 신분증을 확인해요.",
    transfer_days: 30,
    is_listed: true,
  },
  {
    slug: "ss-cafe",
    name: "성수 ○○ 카페 (예시)",
    type: "cafe",
    region: "서울 성동구",
    address: "서울 성동구 성수동 (예시 주소)",
    intro: "매장에서 주운 물건을 카운터에서 보관해요.",
    areas: ["1층 좌석", "2층 좌석", "테라스", "화장실"],
    desk_location: "1층 카운터",
    hours: "매일 10:00–22:00",
    pickup_guide: "카운터 직원에게 말씀해 주세요.",
    transfer_days: 30,
    is_listed: true,
  },
  {
    slug: "bs-festival",
    name: "부산 ○○ 불꽃축제 안내소 (예시)",
    type: "festival",
    region: "부산 수영구",
    address: "부산 수영구 광안리 일대 (예시 주소)",
    intro: "축제장에서 주운 물건을 종합 안내소에서 보관해요.",
    areas: ["A 구역", "B 구역", "푸드트럭 존", "종합 안내소", "임시 주차장"],
    desk_location: "종합 안내소",
    hours: "축제 기간 16:00–23:00",
    pickup_guide: "축제가 끝난 뒤에는 구청 민원실로 옮겨요.",
    transfer_days: 30,
    is_listed: true,
  },
];

const adminEmail = (slug: string) => `admin.${slug}@example.com`;

function assertTarget(url: string) {
  const { hostname } = new URL(url);
  if (hostname === "localhost" || hostname === "127.0.0.1") return;
  // `pnpm db:seed -- --project-ref x` hands node a literal "--", which would end option parsing.
  const args = process.argv.slice(2).filter((a) => a !== "--");
  const { values } = parseArgs({ args, options: { "project-ref": { type: "string" } }, allowPositionals: true });
  const ref = values["project-ref"];
  if (!ref || hostname !== `${ref}.supabase.co`) {
    throw new Error(`Refusing to seed ${hostname}. Run: pnpm db:seed -- --project-ref <ref of that project>`);
  }
}

const supabase = createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Inserts missing demo facilities and returns the ones that are still the seed's own rows. */
async function ensureFacilities() {
  const { error } = await supabase.from("facilities").upsert(FACILITIES, { onConflict: "slug", ignoreDuplicates: true });
  if (error) throw new Error(`facilities insert failed: ${error.message}`);

  const { data, error: readError } = await supabase
    .from("facilities")
    .select("id, slug, name")
    .in("slug", FACILITIES.map((f) => f.slug));
  if (readError) throw new Error(`facilities read failed: ${readError.message}`);

  const seedNames = new Map(FACILITIES.map((f) => [f.slug, f.name]));
  return data.filter((f) => {
    const ours = seedNames.get(f.slug) === f.name;
    if (!ours) console.warn(`skipped  ${f.slug}: already used by "${f.name}", not a demo facility`);
    return ours;
  });
}

async function existingUsersByEmail(): Promise<Map<string, string>> {
  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw new Error(`listUsers failed: ${error.message}`);
  return new Map(data.users.flatMap((u) => (u.email ? [[u.email, u.id] as const] : [])));
}

async function ensureAdmin(email: string, existing: Map<string, string>): Promise<string> {
  const id = existing.get(email);
  if (id) {
    const { error } = await supabase.auth.admin.updateUserById(id, { password: env.SEED_ADMIN_PASSWORD });
    if (error) throw new Error(`update ${email} failed: ${error.message}`);
    return id;
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: env.SEED_ADMIN_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`create ${email} failed: ${error?.message}`);
  return data.user.id;
}

async function main() {
  assertTarget(env.NEXT_PUBLIC_SUPABASE_URL);
  const facilities = await ensureFacilities();
  const users = await existingUsersByEmail();

  for (const facility of facilities) {
    const email = adminEmail(facility.slug);
    const userId = await ensureAdmin(email, users);
    const { error } = await supabase
      .from("facility_members")
      .upsert({ facility_id: facility.id, user_id: userId, role: "owner" }, { onConflict: "facility_id,user_id" });
    if (error) throw new Error(`member upsert failed: ${error.message}`);
    console.log(`seeded  ${facility.name}  →  ${email}`);
  }
  console.log(`\n${facilities.length} demo facilities. Admin password: the SEED_ADMIN_PASSWORD value in .env.local.`);
}

await main();
