import { describe, expect, it } from "vitest";
import { CATEGORY_CODES } from "./constants";
import { ClaimAnswersSchema, claimQuestionsFor, isHighValueCategory, requiredProofFor } from "./claim";

describe("claimQuestionsFor", () => {
  it("같은 분류의 두 습득물에는 같은 질문이 나간다", () => {
    expect(claimQuestionsFor("electronics.earphones")).toEqual(claimQuestionsFor("electronics.earphones"));
    expect(claimQuestionsFor("clothing.gloves")).toEqual(claimQuestionsFor("clothing.hat"));
  });

  it("모든 분류에 질문이 2~3개 있다", () => {
    for (const code of CATEGORY_CODES) {
      const qs = claimQuestionsFor(code);
      expect(qs.length).toBeGreaterThanOrEqual(2);
      expect(qs.length).toBeLessThanOrEqual(3);
    }
  });

  it("§9-1 표대로 분류마다 질문이 다르다", () => {
    expect(claimQuestionsFor("electronics.phone")).toEqual(["screen_case", "back_attached", "last_used"]);
    expect(claimQuestionsFor("electronics.earphones")).toEqual(["appearance", "case_attached", "last_used"]);
    expect(claimQuestionsFor("wallet_card.id")).toEqual(["contents", "appearance", "last_used"]);
    expect(claimQuestionsFor("bag.bag")).toEqual(["contents", "attached", "worn"]);
    expect(claimQuestionsFor("sports.goggles")).toEqual(["brand_size", "marks", "damage"]);
    expect(claimQuestionsFor("key.key")).toEqual(["appearance", "attached", "last_used"]);
  });
});

describe("requiredProofFor / isHighValueCategory", () => {
  it("고가 전자기기는 잠금 해제·일련번호, 지갑·카드는 신분증 대조", () => {
    expect(requiredProofFor("electronics.phone")).toBe("unlock_serial");
    expect(requiredProofFor("wallet_card.card")).toBe("id_check");
    expect(requiredProofFor("bag.bag")).toBeNull();
    expect(isHighValueCategory("electronics.laptop_tablet")).toBe(true);
    expect(isHighValueCategory("electronics.earphones")).toBe(false);
  });
});

describe("ClaimAnswersSchema", () => {
  it("답이 하나도 없으면 거부한다", () => {
    expect(ClaimAnswersSchema.safeParse({ appearance: " ", last_used: "" }).success).toBe(false);
    expect(ClaimAnswersSchema.safeParse({ appearance: "흠집", last_used: "" }).success).toBe(true);
  });

  it("모르는 질문 키는 거부한다", () => {
    expect(ClaimAnswersSchema.safeParse({ secret: "x" }).success).toBe(false);
  });
});
