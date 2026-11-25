import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { signPhotoUrls, uploadFoundItemPhoto } from "./storage";
import { SIGNED_URL_TTL_SECONDS } from "./storage-paths";
import type { Database } from "./supabase/types";

const FACILITY = "11111111-1111-4111-8111-111111111111";

function fakeClient(bucketApi: Record<string, unknown>) {
  const from = vi.fn(() => bucketApi);
  return { client: { storage: { from } } as unknown as SupabaseClient<Database>, from };
}

describe("uploadFoundItemPhoto", () => {
  it("시설 폴더 아래 새 파일 이름으로, 덮어쓰지 않게 올린다", async () => {
    const upload = vi.fn(async () => ({ data: {}, error: null }));
    const { client, from } = fakeClient({ upload });
    const result = await uploadFoundItemPhoto(client, FACILITY, new Blob(["x"], { type: "image/jpeg" }));

    expect(from).toHaveBeenCalledWith("found-items");
    expect(result.ok).toBe(true);
    const [path, , options] = upload.mock.calls[0] as unknown as [string, Blob, { upsert: boolean; contentType: string }];
    expect(path.startsWith(`${FACILITY}/`)).toBe(true);
    expect(path.endsWith(".jpg")).toBe(true);
    expect(options).toEqual({ contentType: "image/jpeg", upsert: false });
  });

  it("업로드가 실패하면 upload_failed를 돌려준다", async () => {
    const upload = vi.fn(async () => ({ data: null, error: { message: "denied" } }));
    const { client } = fakeClient({ upload });
    expect(await uploadFoundItemPhoto(client, FACILITY, new Blob(["x"]))).toEqual({ ok: false, error: "upload_failed" });
  });
});

describe("signPhotoUrls", () => {
  it("경로가 없으면 요청하지 않는다", async () => {
    const createSignedUrls = vi.fn();
    const { client } = fakeClient({ createSignedUrls });
    expect((await signPhotoUrls(client, "found-items", [])).size).toBe(0);
    expect(createSignedUrls).not.toHaveBeenCalled();
  });

  it("10분 만료로 서명하고, 읽을 수 없는 경로는 결과에서 뺀다", async () => {
    const createSignedUrls = vi.fn(async () => ({
      data: [
        { path: "a.jpg", signedUrl: "https://signed/a", error: null },
        { path: "b.jpg", signedUrl: "", error: "Either the object does not exist or you do not have access to it" },
      ],
      error: null,
    }));
    const { client } = fakeClient({ createSignedUrls });
    const urls = await signPhotoUrls(client, "found-items", ["a.jpg", "b.jpg"]);

    expect(createSignedUrls).toHaveBeenCalledWith(["a.jpg", "b.jpg"], SIGNED_URL_TTL_SECONDS);
    expect([...urls]).toEqual([["a.jpg", "https://signed/a"]]);
  });
});
