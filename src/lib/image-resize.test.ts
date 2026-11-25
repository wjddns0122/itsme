import { describe, expect, it } from "vitest";
import { fitWithin, isImageFile } from "./image-resize";

describe("fitWithin", () => {
  it("긴 변을 1280px로 줄이고 비율을 지킨다", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1280, height: 960 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 960, height: 1280 });
  });

  it("작은 사진은 키우지 않는다", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});

describe("isImageFile", () => {
  it("이미지가 아닌 파일을 거른다", () => {
    expect(isImageFile(new File(["x"], "a.jpg", { type: "image/jpeg" }))).toBe(true);
    expect(isImageFile(new File(["x"], "a.pdf", { type: "application/pdf" }))).toBe(false);
  });
});
