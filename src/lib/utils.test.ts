import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("joins class names and drops falsy values", () => {
    expect(cn("px-2", false, undefined, "py-1")).toBe("px-2 py-1");
  });

  it("lets the later Tailwind class win on conflict", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("디자인 토큰 글자 크기와 글자 색을 함께 남긴다", () => {
    expect(cn("text-body text-ink", "text-blush-ink")).toBe("text-body text-blush-ink");
    expect(cn("text-primary-foreground", "text-button-lg")).toBe("text-primary-foreground text-button-lg");
  });

  it("디자인 토큰 글자 크기끼리는 뒤의 것이 이긴다", () => {
    expect(cn("text-sm", "text-caption")).toBe("text-caption");
  });

  it("디자인 토큰 둥글기는 기본 둥글기를 덮어쓴다", () => {
    expect(cn("rounded-lg", "rounded-ui-sm")).toBe("rounded-ui-sm");
  });
});
