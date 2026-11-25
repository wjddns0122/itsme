import { describe, expect, it } from "vitest";
import { maskContactKey, parseContactSearch, normalizeEmail, normalizePhone, toContactKey } from "./contact";

describe("normalizePhone", () => {
  it("숫자만 남긴다", () => {
    expect(normalizePhone("010-1234-5678")).toBe("01012345678");
    expect(normalizePhone(" 010 1234 5678 ")).toBe("01012345678");
  });

  it("앞의 82를 0으로 바꾼다", () => {
    expect(normalizePhone("+82 10-1234-5678")).toBe("01012345678");
    expect(normalizePhone("821012345678")).toBe("01012345678");
  });

  it("지역번호 전화도 받는다", () => {
    expect(normalizePhone("033-000-0000")).toBe("0330000000");
  });

  it("전화번호가 아니면 null", () => {
    expect(normalizePhone("1234")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("1012345678")).toBeNull();
  });
});

describe("normalizeEmail", () => {
  it("앞뒤 공백을 빼고 소문자로", () => {
    expect(normalizeEmail("  Minji.K@Example.COM ")).toBe("minji.k@example.com");
  });
});

describe("toContactKey", () => {
  it("전화번호가 있으면 전화번호로", () => {
    expect(toContactKey({ phone: "010-1234-5678", email: "a@example.com" })).toBe("01012345678");
  });

  it("전화번호가 없거나 형식이 틀리면 이메일로", () => {
    expect(toContactKey({ email: "A@Example.com" })).toBe("a@example.com");
    expect(toContactKey({ phone: "12", email: "a@example.com" })).toBe("a@example.com");
  });

  it("둘 다 없으면 null", () => {
    expect(toContactKey({})).toBeNull();
    expect(toContactKey({ phone: "", email: "  " })).toBeNull();
  });
});

describe("maskContactKey", () => {
  it("전화번호는 가운데를 가린다", () => {
    expect(maskContactKey("01012345678")).toBe("010-****-5678");
  });

  it("이메일은 앞 두 글자만 남긴다", () => {
    expect(maskContactKey("minji.k@example.com")).toBe("mi***@example.com");
  });
});

describe("parseContactSearch", () => {
  it("숫자 4개는 전화번호 뒷자리로 찾는다", () => {
    expect(parseContactSearch(" 5678 ")).toEqual({ kind: "suffix", value: "5678" });
  });

  it("전화번호·이메일 전체는 정규화해서 그대로 찾는다", () => {
    expect(parseContactSearch("010-1234-5678")).toEqual({ kind: "exact", value: "01012345678" });
    expect(parseContactSearch("Me@Example.com")).toEqual({ kind: "exact", value: "me@example.com" });
  });

  it("그 밖의 입력은 null", () => {
    expect(parseContactSearch("김민지")).toBeNull();
    expect(parseContactSearch("123")).toBeNull();
  });
});
