// Category codes and standard colors: docs/05-ai-matching.md §2-1, §2-2.
// The top-level group is the part before the dot.

export const CATEGORIES = [
  { code: "electronics.phone", label: "휴대폰", sensitive: false, highValue: true },
  { code: "electronics.earphones", label: "이어폰·헤드폰", sensitive: false, highValue: false },
  { code: "electronics.charger", label: "충전기·케이블·보조배터리", sensitive: false, highValue: false },
  { code: "electronics.laptop_tablet", label: "노트북·태블릿", sensitive: false, highValue: true },
  { code: "electronics.watch", label: "스마트워치", sensitive: false, highValue: true },
  { code: "electronics.other", label: "기타 전자기기", sensitive: false, highValue: false },
  { code: "wallet_card.wallet", label: "지갑", sensitive: false, highValue: false },
  { code: "wallet_card.card", label: "카드·교통카드", sensitive: true, highValue: false },
  { code: "wallet_card.id", label: "신분증·학생증", sensitive: true, highValue: false },
  { code: "bag.bag", label: "가방·파우치", sensitive: false, highValue: false },
  { code: "clothing.outer", label: "외투", sensitive: false, highValue: false },
  { code: "clothing.gloves", label: "장갑", sensitive: false, highValue: false },
  { code: "clothing.hat", label: "모자·비니", sensitive: false, highValue: false },
  { code: "clothing.scarf", label: "목도리·넥워머", sensitive: false, highValue: false },
  { code: "clothing.other", label: "기타 의류", sensitive: false, highValue: false },
  { code: "sports.goggles", label: "고글", sensitive: false, highValue: false },
  { code: "sports.helmet", label: "헬멧", sensitive: false, highValue: false },
  { code: "sports.gear", label: "스키·보드 장비", sensitive: false, highValue: false },
  { code: "accessory.glasses", label: "안경·선글라스", sensitive: false, highValue: false },
  { code: "accessory.jewelry", label: "액세서리·주얼리", sensitive: false, highValue: false },
  { code: "accessory.watch", label: "손목시계", sensitive: false, highValue: false },
  { code: "key.key", label: "열쇠·차키", sensitive: false, highValue: false },
  { code: "umbrella.umbrella", label: "우산", sensitive: false, highValue: false },
  { code: "document.document", label: "서류·책", sensitive: false, highValue: false },
  { code: "other.other", label: "기타", sensitive: false, highValue: false },
] as const;

export type CategoryCode = (typeof CATEGORIES)[number]["code"];

export const CATEGORY_CODES = CATEGORIES.map((c) => c.code) as [CategoryCode, ...CategoryCode[]];

export const UNKNOWN_CATEGORY: CategoryCode = "other.other";

export const COLORS = [
  "검정", "흰색", "회색", "은색", "금색", "빨강", "주황", "노랑", "초록",
  "파랑", "남색", "하늘색", "보라", "분홍", "갈색", "베이지", "투명", "여러 색",
] as const;

export type Color = (typeof COLORS)[number];

export function categoryGroup(code: string): string {
  return code.split(".")[0] ?? code;
}

export function categoryLabel(code: string): string {
  return CATEGORIES.find((c) => c.code === code)?.label ?? "기타";
}

/** Top-level groups for list filters and compact labels (A-04 표의 분류 열). */
export const CATEGORY_GROUPS = [
  { group: "electronics", label: "전자기기" },
  { group: "wallet_card", label: "지갑·카드" },
  { group: "bag", label: "가방" },
  { group: "clothing", label: "옷·장갑" },
  { group: "sports", label: "고글·헬멧" },
  { group: "accessory", label: "안경·액세서리" },
  { group: "key", label: "열쇠" },
  { group: "umbrella", label: "우산" },
  { group: "document", label: "서류·책" },
  { group: "other", label: "기타" },
] as const;

export type CategoryGroup = (typeof CATEGORY_GROUPS)[number]["group"];

export function categoryGroupLabel(code: string): string {
  const group = categoryGroup(code);
  return CATEGORY_GROUPS.find((g) => g.group === group)?.label ?? "기타";
}

/** Label for a category code or a bare group code ("sports" from the P-03 chips). */
export function categoryOrGroupLabel(code: string): string {
  const leaf = CATEGORIES.find((c) => c.code === code);
  if (leaf) return leaf.label;
  return CATEGORY_GROUPS.find((g) => g.group === code)?.label ?? "기타";
}

const SENSITIVE = new Set<string>(CATEGORIES.filter((c) => c.sensitive).map((c) => c.code));

/** Cards and IDs are always sensitive, whatever the switch says (.claude/rules/ai.md). */
export function isSensitiveCategory(code: string): boolean {
  return SENSITIVE.has(code);
}
