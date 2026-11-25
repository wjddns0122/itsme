# 05. AI 추출·매칭 명세

> 프롬프트와 스키마의 기준 문서. 코드(`lib/ai/prompts.ts`, `lib/validation/`)를 바꾸면 이 문서도 고친다.
> 점수·임계값은 **초기값**이다. §7 평가로 조정하고, 바꾸면 날짜와 근거를 §10 변경 기록에 남긴다.

---

## 1. 개요

모델을 학습하지 않는다. 사진과 문장을 **같은 형식의 구조화 데이터**로 바꾼 뒤, 그 텍스트의 임베딩과 속성을 비교한다.

```mermaid
flowchart LR
    subgraph found["습득물"]
        P["사진 1~3장"] --> X["Claude: 사진 분석 §3"]
        X --> D1["ItemDescriptor + 공개/비공개 구분"]
    end
    subgraph lost["분실 신고"]
        T["자연어 설명"] --> N["Claude: 설명 정규화 §4"]
        N --> D2["ItemDescriptor"]
    end
    D1 --> S1["buildSearchText"] --> E1["임베딩"]
    D2 --> S2["buildSearchText"] --> E2["임베딩"]
    E1 --> V["pgvector 후보 20개"]
    E2 --> V
    V --> SC["score.ts: 특징 60 + 장소 25 + 날짜 15 §5"]
    SC --> C["후보 저장 0.45 이상, 최대 5개"]
```

AI 호출은 세 종류다.

| 호출 | 시점 | 모델 | 사용자가 기다리나 |
|---|---|---|---|
| 사진 분석 | 관리자 등록 화면 | `VISION_MODEL` (기본 `claude-opus-5-5`) | 예 → p95 8초 목표 |
| 설명 정규화 | 신고 저장 후 백그라운드 | `LLM_MODEL` (기본 `claude-opus-5-5`) | 아니오 |
| 임베딩 | 습득물·신고 저장 후, 관리자 검색 시 | `EMBEDDING_MODEL` (기본 `text-embedding-3-small`) | 검색 시에만 |

## 2. 공통 스키마

### 2-1. 분류 코드

대분류는 `.` 앞부분이다. 대분류가 같으면 "비슷한 분류"로 본다.

| 코드 | 표시 이름 | 비고 |
|---|---|---|
| `electronics.phone` | 휴대폰 | |
| `electronics.earphones` | 이어폰·헤드폰 | |
| `electronics.charger` | 충전기·케이블·보조배터리 | |
| `electronics.laptop_tablet` | 노트북·태블릿 | |
| `electronics.watch` | 스마트워치 | |
| `electronics.other` | 기타 전자기기 | |
| `wallet_card.wallet` | 지갑 | |
| `wallet_card.card` | 카드·교통카드 | 민감 |
| `wallet_card.id` | 신분증·학생증 | 민감 |
| `bag.bag` | 가방·파우치 | |
| `clothing.outer` | 외투 | |
| `clothing.gloves` | 장갑 | |
| `clothing.hat` | 모자·비니 | |
| `clothing.scarf` | 목도리·넥워머 | |
| `clothing.other` | 기타 의류 | |
| `sports.goggles` | 고글 | |
| `sports.helmet` | 헬멧 | |
| `sports.gear` | 스키·보드 장비 | |
| `accessory.glasses` | 안경·선글라스 | |
| `accessory.jewelry` | 액세서리·주얼리 | |
| `accessory.watch` | 손목시계 | |
| `key.key` | 열쇠·차키 | |
| `umbrella.umbrella` | 우산 | |
| `document.document` | 서류·책 | |
| `other.other` | 기타 | |

### 2-2. 표준 색상

`검정, 흰색, 회색, 은색, 금색, 빨강, 주황, 노랑, 초록, 파랑, 남색, 하늘색, 보라, 분홍, 갈색, 베이지, 투명, 여러 색`

### 2-3. zod 스키마 (`lib/validation/ai.ts`)

```ts
import { z } from 'zod';
import { CATEGORY_CODES, COLORS } from './constants';

// 습득물·신고 공통
export const ItemDescriptor = z.object({
  category: z.enum(CATEGORY_CODES),
  subcategory: z.string().nullable(),   // "무선 이어폰", "스키 고글"
  colors: z.array(z.enum(COLORS)),      // 많아야 3개 (후처리에서 자름)
  brand: z.string().nullable(),         // 확실할 때만
  material: z.string().nullable(),
  features: z.array(z.string()),        // 관찰 가능한 특징
  confidence: z.number(),               // 0~1, 분류 확신도
});

// 사진 분석 결과
export const FoundItemExtraction = ItemDescriptor.extend({
  public_summary: z.string(),           // 분실자에게 보여도 되는 한 문장
  private_features: z.array(z.string()),// 주인만 알 법한 식별 특징
  is_sensitive: z.boolean(),
});

// 설명 정규화 결과
export const LostReportNormalization = ItemDescriptor.extend({
  language: z.string(),                 // 원문 언어 코드 (ko, en, ja, zh ...)
});
```

- structured outputs가 지원하지 않는 스키마 제약이 있을 수 있으므로, **모델에 넘기는 스키마는 단순하게** 두고 개수·범위 검증(색상 3개 이하, features 8개 이하, confidence 0~1)은 파싱 후 코드에서 한다.
- `features`(공개)와 `private_features`(비공개)의 구분이 이 서비스의 핵심 안전장치다.

### 2-4. 임베딩 입력 텍스트 (`buildSearchText`)

LLM이 자유롭게 쓴 문장이 아니라 **코드가 같은 틀로 만든 텍스트**를 임베딩한다. 습득물과 신고가 같은 형식이어야 유사도가 안정적이다.

```ts
export function buildSearchText(d: ItemDescriptor, extra: string[] = []): string {
  const features = [...d.features, ...extra];
  return [
    `분류: ${CATEGORY_LABEL[d.category]}${d.subcategory ? ` / ${d.subcategory}` : ''}`,
    d.colors.length ? `색상: ${d.colors.join(', ')}` : null,
    d.brand ? `브랜드: ${d.brand}` : null,
    d.material ? `재질: ${d.material}` : null,
    features.length ? `특징: ${features.join(', ')}` : null,
  ].filter(Boolean).join('\n');
}
```

- 습득물: `extra = private_features` (비공개 특징도 임베딩에는 넣는다. 벡터는 외부에 노출되지 않는다).
- 신고: 정규화 입력에 `secret_detail`을 함께 넣으므로 별도 `extra` 없음.

## 3. 습득물 사진 분석

### 3-1. 호출

- 입력: 이미지 1~3장 (base64 JPEG, 긴 변 1280px) + 텍스트 `시설 종류: {facility.type} / 습득 구역: {found_area 또는 "미입력"}`
- 출력: `FoundItemExtraction` (structured outputs)
- 설정: `output_config.effort: "low"`, `max_tokens: 8000`, SDK `timeout` 15초, `maxRetries` 1
- 화면: 10초가 지나면 "직접 입력하기" 버튼을 함께 보여준다 (응답이 오면 그때 채움).

### 3-2. 시스템 프롬프트 (v1)

```text
너는 분실물 보관소 직원을 돕는 도우미야. 사진 속 물건 하나를 보고 습득물 등록 양식을 채워.

규칙
1. 사진에서 실제로 보이는 것만 적어. 보이지 않는 내용은 추측하지 마.
2. 브랜드는 로고나 글자가 보일 때만 적어. 모양만 보고 짐작했다면 brand는 null로 두고,
   features에 "OO과 비슷한 모양"이라고 적어.
3. category는 주어진 목록에서 골라. 애매하면 가장 가까운 것을 고르고 confidence를 낮춰.
4. 특징을 공개용과 비공개용으로 나눠.
   - public_summary: 분실자에게 보여줘도 되는 한 문장. 분류, 색상, 크기 정도만.
     예) "검은색 무선 이어폰 케이스"
   - features: 여러 사람이 가진 물건에도 있을 법한 일반 특징.
     예) "무광 재질", "케이스형"
   - private_features: 주인만 알 법한 식별 특징. 스티커, 키링, 이니셜, 흠집, 무늬, 안에 든 물건.
     예) "은색 별 모양 키링", "뒷면 왼쪽 아래 긁힘", "지갑 안 교통카드 1장"
   public_summary와 features에는 private_features의 내용을 넣지 마.
5. 신분증, 학생증, 신용카드, 여권, 운전면허증이 보이면 is_sensitive를 true로 해.
   이름, 생년월일, 카드번호, 학번, 주소 같은 개인정보는 어떤 필드에도 적지 마.
   "학생증 (이름 가림)"처럼 써.
6. 사진에 물건이 여러 개면 가장 크고 가운데 있는 물건 하나만 기록하고,
   features에 "함께 찍힌 물건: ..."을 적어.
7. 모든 텍스트는 한국어로 써.

분류 목록: {CATEGORY_CODES와 표시 이름}
색상 목록: {COLORS}
```

### 3-3. 후처리

1. zod 파싱. 실패하면 1회 재시도, 다시 실패하면 `extraction: null` (수동 입력).
2. `colors` 3개, `features`·`private_features` 각 8개로 자른다.
3. `category`가 `wallet_card.card` 또는 `wallet_card.id`면 `is_sensitive = true`로 강제.
4. 개인정보 패턴 마스킹 (안전망): 숫자 6자리 이상 연속, 이메일, 전화번호 형식 → `***`.
5. `ai_raw`에 원본 응답과 `usage` 저장, `ai_latency_ms` 기록.

## 4. 분실 설명 정규화

### 4-1. 호출

- 입력: `설명: {description}` + (있으면) `추가 특징: {secret_detail}` + (있으면) `분실자가 고른 분류: {user_category}`
- **연락처, 이름은 넣지 않는다.**
- 출력: `LostReportNormalization`
- 설정: `output_config.effort: "low"`, `max_tokens: 8000`

### 4-2. 시스템 프롬프트 (v1)

```text
너는 분실 신고 문장을 분실물 검색용 정보로 정리해.

규칙
1. 신고자가 쓴 내용만 옮겨. 쓰지 않은 색상, 브랜드, 특징을 지어내지 마.
2. category는 목록에서 골라. "분실자가 고른 분류"가 있으면 그것을 우선해.
3. 색상은 표준 색상 목록으로 바꿔. 예) "곤색" → "남색", "실버" → "은색", "아이보리" → "베이지"
4. 제품 별칭은 표준 이름으로 바꿔. 예) "에어팟" → brand "Apple", subcategory "무선 이어폰"
5. 여러 물건을 잃어버렸다고 쓰면 첫 번째 물건만 정리하고,
   features에 "함께 잃어버린 물건: ..."을 적어.
6. 장소, 시간, 연락처는 정리하지 마. 다른 칸에서 따로 받아.
7. 외국어로 쓰였으면 한국어로 옮겨서 정리하고, language에 원래 언어 코드를 적어.
8. 정보가 너무 적으면 category는 "other.other", confidence는 0.3 이하로 해.

분류 목록: {CATEGORY_CODES와 표시 이름}
색상 목록: {COLORS}
```

### 4-3. 실패 처리

정규화가 실패하면 `ai_status = 'failed'`, `category = user_category`, `search_text = description` 원문으로 임베딩하고 매칭을 계속한다.

## 5. 점수 계산 (`lib/matching/score.ts`)

### 5-1. 공식

```
최종 점수 = 0.60 × 특징 + 0.25 × 장소 + 0.15 × 날짜        (0~1)

특징  = 0.70 × 벡터 + 0.30 × 속성
벡터  = clamp((cos − 0.30) / (0.80 − 0.30), 0, 1)           # cos: 임베딩 코사인 유사도
속성  = 0.5 × 분류 + 0.3 × 색상 + 0.2 × 브랜드
```

| 항목 | 값 |
|---|---|
| **분류** | 세부 분류 같음 1.0 / 대분류만 같음 0.6 / 한쪽이 `other.other` 0.3 / 다름 0 |
| **색상** | 자카드 유사도 \|A∩B\| / \|A∪B\|. 한쪽이 비어 있으면 0.5 |
| **브랜드** | 둘 다 있고 같음 1.0 / 한쪽이 null 0.5 / 다름 0 (대소문자·공백 무시) |
| **장소** | 같은 구역 1.0 / 한쪽이 구역 모름 0.7 / 다른 구역 0.5 / (P1) 같은 지역 다른 시설 0.3 |
| **날짜** | 습득일 d (한국 시간). `lost_from−1 ≤ d ≤ lost_to+1` → 1.0. `d > lost_to+1` → `max(0, 1 − (d − (lost_to+1)) / 14)`. `d < lost_from−1` → 후보 제외 (SQL에서 이미 걸러짐) |

**제외 규칙**: 양쪽 분류 confidence가 모두 0.7 이상이고 대분류가 다르며 어느 쪽도 `other`가 아니면 후보에서 뺀다.

**예시** (사업계획서의 시뮬레이션과 같은 값): 특징 0.92, 장소 1.0, 날짜 0.8 → 0.6×0.92 + 0.25×1.0 + 0.15×0.8 = **0.922**

### 5-2. 임계값

| 이름 | 초기값 | 쓰임 |
|---|---|---|
| `MATCH_SAVE_THRESHOLD` | 0.45 | 이 점수 이상만 후보로 저장 (신고당 최대 5개) |
| `MATCH_NOTIFY_THRESHOLD` | 0.70 | 이 점수 이상 새 후보가 생기면 이메일. 화면 라벨 "유사도 높음" |
| `COS_LOW`, `COS_HIGH` | 0.30, 0.80 | 코사인 보정 구간. 임베딩 모델을 바꾸면 반드시 다시 잡는다 |

### 5-3. 함수 형태

```ts
export type ScoreInput = {
  vecSim: number;
  a: { category: string; colors: string[]; brand: string | null; confidence: number | null };
  b: { category: string; colors: string[]; brand: string | null; confidence: number | null };
  area: { report: string | null; item: string | null };
  date: { lostFrom: string; lostTo: string; found: string };  // YYYY-MM-DD (KST)
};
export type ScoreResult =
  | { excluded: true; reason: 'category_mismatch' | 'date_before_loss' }
  | { excluded: false; score: number; breakdown: { feature: number; place: number; date: number; vec: number; attr: number } };

export function scoreCandidate(input: ScoreInput, cfg = DEFAULT_CONFIG): ScoreResult;
```

순수 함수다. DB·네트워크에 접근하지 않는다. 단위 테스트로 §5-1의 표 모든 칸과 예시(0.922)를 검증한다.

## 6. 실행 계기와 저장 규칙

| 계기 | 실행 | 비고 |
|---|---|---|
| 신고 저장 | 정규화 → 임베딩 → `match_items_for_report` → 점수 → 저장 → 알림 | `after()` |
| 습득물 저장 | 임베딩 → `match_reports_for_item` → 점수 → 저장 → 알림 | `after()` |
| 습득물 수정 (분류·색상·브랜드·특징) | 재임베딩 → 역방향 매칭 | 기존 `suggested` 후보는 점수만 갱신 |
| 관리자 "다시 분석" | `ai_status = failed`인 것 재처리 | |

저장 규칙
- `(lost_report_id, found_item_id)` 기준 upsert. 두 번 실행돼도 결과가 같아야 한다.
- 상태가 `suggested`인 후보만 점수를 갱신한다. `claimed` 이후는 건드리지 않는다.
- 분실자가 `dismissed`한 후보는 다시 만들지 않는다.
- 신고당 `suggested` 후보는 점수 상위 5개만 유지한다.
- 새로 0.70을 넘은 후보만 알림 대상이다 (`notified_at is null`).

## 7. 평가

### 7-1. 데이터 모으기 (Day 2~3)

1. **실제 물건 30~50개**를 팀원·지인에게서 모은다.
2. 물건 주인은 맡기기 **전에** 사진을 보지 않고 기억대로 60초 안에 설명을 쓴다 (실제 분실자처럼).
3. 다른 사람이 관리자 역할로 A-03에서 등록한다.
4. **비슷한 물건 묶음**을 일부러 넣는다: 검은 무선 이어폰 3개, 검은 장갑 2켤레, 흰 충전기 3개, 비슷한 카드지갑 2개 이상.
5. **미끼 신고 10건**: 등록하지 않은 물건의 설명. 후보가 높게 나오면 안 된다.
6. 분실 날짜·구역은 실제 사람처럼 가끔 하루 틀리거나 "잘 모르겠어요"로 둔다.
7. 정답 표: 습득물마다 실제 분류와 색상을 사람이 적는다 (추출 정확도 측정용).

### 7-2. 파일 형식 (`eval/cases.json`)

```json
{
  "items": [
    {
      "key": "I01",
      "photos": ["eval/photos/I01-1.jpg"],
      "found_at": "2026-11-27T10:20:00+09:00",
      "found_area": "3층 강의실",
      "truth": { "category": "electronics.earphones", "colors": ["검정"] }
    }
  ],
  "reports": [
    {
      "key": "R01",
      "description": "검은색 무선 이어폰인데 케이스에 은색 키링이 달려 있어요",
      "secret_detail": "케이스 안쪽에 고양이 스티커",
      "lost_from": "2026-11-27",
      "lost_to": "2026-11-27",
      "lost_area": "3층 강의실",
      "expected_item": "I01",
      "split": "dev"
    },
    {
      "key": "R41",
      "description": "남색 장지갑, 지퍼 고장남",
      "lost_from": "2026-11-26",
      "lost_to": "2026-11-27",
      "lost_area": null,
      "expected_item": null,
      "split": "test"
    }
  ]
}
```

### 7-3. 실행 (`pnpm eval`)

1. 평가 전용 시설(`slug = eval-YYYYMMDD`)을 만든다. 운영 데이터와 섞지 않는다.
2. 습득물을 모두 등록(실제 사진 분석 호출) → 신고를 모두 넣고 매칭.
3. 지표를 계산해 `eval/results/YYYY-MM-DD.md`에 저장하고 터미널에 표로 출력한다.
4. 평가 시설을 지운다 (`--keep` 옵션이면 남김).

### 7-4. 지표

| 지표 | 정의 | 목표 |
|---|---|---|
| Top-1 정확도 | 정답이 1위인 신고 비율 | 참고 |
| **Top-3 재현율** | 정답이 3위 안에 있는 신고 비율 (정답 있는 신고만) | 90% 이상 |
| MRR | 정답 순위 역수의 평균 | 참고 |
| **오알림률** | 미끼 신고 중 0.70 이상 후보가 생긴 비율 | 10% 이하 |
| 잘못된 1위 알림 | 정답 있는 신고에서 1위가 오답인데 0.70 이상인 비율 | 낮을수록 좋음 |
| 분류 정확도 | 사진 분석 분류 = 정답 분류 | 90% 이상 |
| 색상 정확도 | 정답 색상이 추출 색상에 포함 | 참고 |
| 사진 분석 지연 | p50, p95 | p95 8초 이하 |
| 건당 비용 | `usage` 토큰 × 단가 | 기록 |

### 7-5. 과적합 막기

- 신고를 `dev`와 `test` 반반으로 나눈다.
- 가중치·임계값·프롬프트는 `dev` 결과만 보고 고친다.
- 발표에는 `test` 결과를 쓴다.
- 표본이 작으므로 숫자와 함께 표본 수를 반드시 적는다: "Top-3 재현율 93% (test 신고 15건, 2026-11-27 팀 자체 평가)".

## 8. Claude API 호출 규칙

- 공식 SDK `@anthropic-ai/sdk`. 클라이언트는 `lib/ai/client.ts`에 하나만 만든다.
- 구조화 출력은 **structured outputs** (`client.messages.parse()` + zod, 또는 `output_config.format`). 정확한 헬퍼 이름은 구현 시 SDK 문서로 확인한다.
- `claude-opus-5-5`는 강제 `tool_choice`(`any`, `tool`)에 400을 낸다. JSON을 받으려고 tool을 강제하지 않는다.
- `temperature`, `top_p`, `top_k`는 보내지 않는다 (400).
- `claude-opus-5-5`는 thinking을 끌 수 없다. 대신 `output_config.effort`로 조절한다 (추출은 `low`부터).
- `stop_reason`을 먼저 확인한다: `refusal`이면 실패 처리, `max_tokens`면 1회 재시도.
- 서버 측 fallback을 켠다: beta `server-side-fallback-2026-07-01` + `fallbacks: "default"`.
- 매 호출마다 `{ kind, model, latency_ms, usage, stop_reason }`을 로그로 남긴다.
- 모델 변경(예: 더 빠른 모델)은 비용·속도·정확도를 §7 평가로 비교한 뒤 ADR로 결정한다 (ADR-009).

## 9. P1 — LLM 재순위

점수 상위 5개 후보를 한 번에 LLM에 보내 "같은 물건일 가능성: 높음/중간/낮음 + 이유 한 줄"을 받는다.

- 입력: 신고 descriptor + 원문, 후보별 descriptor + 공개·비공개 특징 (서버 안에서만 사용)
- 최종 점수 = 0.7 × 규칙 점수 + 0.3 × LLM 라벨 점수 (높음 1.0 / 중간 0.5 / 낮음 0)
- 오알림률이 목표를 못 맞출 때 도입한다. 비용·지연이 늘어나므로 평가로 효과를 확인한 뒤 켠다.

## 10. 변경 기록

| 날짜 | 변경 | 근거 |
|---|---|---|
| 2026-11-25 | v1 초안 (가중치 60/25/15, 임계값 0.45/0.70) | 사업계획서 초기 설계 |
