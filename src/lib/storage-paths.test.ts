import { describe, expect, it } from "vitest";
import { claimPhotoPath, facilityIdOfPath, foundItemPhotoPath, reportPhotoPath } from "./storage-paths";

const FACILITY = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const FILE = "33333333-3333-4333-8333-333333333333";

describe("storage paths", () => {
  it("습득물 사진 경로는 시설 id 폴더로 시작한다", () => {
    expect(foundItemPhotoPath(FACILITY, FILE)).toBe(`${FACILITY}/${FILE}.jpg`);
  });

  it("확인 요청·신고 사진은 시설 id 다음에 후보·신고 id 폴더를 둔다", () => {
    expect(claimPhotoPath(FACILITY, OTHER, FILE)).toBe(`${FACILITY}/${OTHER}/${FILE}.jpg`);
    expect(reportPhotoPath(FACILITY, OTHER, FILE)).toBe(`${FACILITY}/${OTHER}/${FILE}.jpg`);
  });

  it("uuid가 아닌 값으로는 경로를 만들지 않는다 (../ 같은 경로 조작 방지)", () => {
    expect(() => foundItemPhotoPath("../other", FILE)).toThrow();
    expect(() => foundItemPhotoPath(FACILITY, "a/b")).toThrow();
    expect(() => claimPhotoPath(FACILITY, "x", FILE)).toThrow();
  });

  it("경로에서 시설 id를 읽고, 형식이 다르면 null을 준다", () => {
    expect(facilityIdOfPath(`${FACILITY}/${FILE}.jpg`)).toBe(FACILITY);
    expect(facilityIdOfPath("not-a-uuid/x.jpg")).toBeNull();
    expect(facilityIdOfPath("")).toBeNull();
  });
});
