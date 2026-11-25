import { describe, expect, it } from "vitest";
import { CATEGORY_CODES } from "./constants";
import { ClaimAnswersSchema, MarkReturnedSchema, ReviewClaimSchema, claimQuestionsFor, isHighValueCategory, requiredProofFor, returnMethodsFor } from "./claim";

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

describe("ReviewClaimSchema", () => {
  const id = "0b8f7c3e-2f5a-4c55-9f1e-6d2a3b4c5d6e";
  it("추가 증빙 요청은 요청 문구가, 보류는 메모가 있어야 한다", () => {
    expect(ReviewClaimSchema.safeParse({ id, action: "request_proof", message: " ", note: null }).success).toBe(false);
    expect(ReviewClaimSchema.safeParse({ id, action: "hold", message: null, note: "" }).success).toBe(false);
    expect(ReviewClaimSchema.safeParse({ id, action: "hold", message: null, note: "전화로 확인" }).success).toBe(true);
  });

  it("승인 안내 문구는 비어 있어도 된다", () => {
    expect(ReviewClaimSchema.safeParse({ id, action: "approve", message: "", note: null }).success).toBe(true);
  });
});

describe("MarkReturnedSchema", () => {
  it("수령인 이름은 필수다", () => {
    const base = { itemId: "0b8f7c3e-2f5a-4c55-9f1e-6d2a3b4c5d6e", candidateId: null, method: "id_check", note: null };
    expect(MarkReturnedSchema.safeParse({ ...base, recipient: "  " }).success).toBe(false);
    expect(MarkReturnedSchema.safeParse({ ...base, recipient: "김예시" }).success).toBe(true);
  });
});

describe("returnMethodsFor", () => {
  it("고가품·지갑·신분증은 잠금 해제·일련번호·신분증 확인만 고를 수 있다", () => {
    expect(returnMethodsFor("electronics.phone")).toEqual(["id_check", "unlock", "serial"]);
    expect(returnMethodsFor("wallet_card.wallet")).toEqual(["id_check", "unlock", "serial"]);
    expect(returnMethodsFor("umbrella.umbrella")).toHaveLength(6);
  });
});
