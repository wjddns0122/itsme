# 02. 사용자 흐름

> 다이어그램은 Mermaid로 썼다. GitHub, VS Code 미리보기, Notion에서 그림으로 보인다.
> 화면 ID(`P-xx`, `A-xx`)는 `03-screens.md`와 같다.

---

## 1. 전체 흐름

```mermaid
flowchart LR
    subgraph found["습득"]
        F1["습득자가 물건 발견"] --> F2["시설 안내데스크에 맡김"]
        F2 --> F3["관리자: 사진 촬영 A-03"]
        F3 --> F4["AI가 양식 자동 작성"]
        F4 --> F5["관리자 확인 후 저장"]
    end
    subgraph lost["분실"]
        L1["분실자가 분실 인지"] --> L2["시설 QR 또는 링크 접속 P-02"]
        L2 --> L3["자연어로 신고 P-03"]
        L3 --> L4["신고 링크 받음 P-04"]
    end
    F5 --> M["AI 매칭 엔진"]
    L4 --> M
    M --> C["후보 추천 + 이메일 알림"]
    C --> D["분실자: 내 물건 같아요 P-05"]
    D --> E["관리자: 비공개 특징으로 확인 A-06"]
    E --> R["반환 완료 기록"]
```

## 2. Flow A — 습득물 등록 (관리자)

목표: 사진 한 장으로 15초 안에 등록.

```mermaid
flowchart TD
    A0(["관리자가 A-03 진입"]) --> A1["사진 촬영 또는 선택, 1~3장"]
    A1 --> A2["브라우저에서 긴 변 1280px로 축소"]
    A2 --> A3["서버: 저장소 업로드 + AI 분석 동시 실행"]
    A3 --> A4{"AI 결과 성공?"}
    A4 -->|"성공"| A5["양식 자동 채움: 분류, 색상, 브랜드, 공개 설명, 비공개 특징"]
    A4 -->|"실패 또는 10초 초과"| A6["빈 양식 + 안내: 직접 입력해 주세요"]
    A5 --> A7{"민감 물품?"}
    A7 -->|"예"| A8["민감 물품 배지 표시, 사진 비공개 고정"]
    A7 -->|"아니오"| A9["관리자 확인·수정"]
    A8 --> A9
    A6 --> A9
    A9 --> A10["습득 일시 기본값 지금, 구역, 보관 위치 입력"]
    A10 --> A11["저장"]
    A11 --> A12["목록으로 이동 + 토스트: 등록했어요"]
    A11 -.->|"응답 후 백그라운드"| A13["임베딩 생성 → 역방향 매칭 Flow C"]
```

규칙
- 보관 위치는 직전에 입력한 값을 기본값으로 채운다 (연속 등록이 빠르도록).
- "저장 후 계속 등록" 버튼을 둔다.

## 3. Flow B — 분실 신고 (분실자)

목표: 로그인 없이 60초 안에 신고.

```mermaid
flowchart TD
    B0(["QR 스캔 또는 링크"]) --> B1["P-02 시설 랜딩"]
    B1 -->|"물건을 잃어버렸어요"| B2["P-03 1단계: 무엇을 잃어버렸나요"]
    B1 -->|"물건을 주웠어요"| G["Flow G"]
    B2 --> B3["자유 서술 10자 이상 + 분류 선택은 선택"]
    B3 --> B4["P-03 2단계: 언제, 어디서"]
    B4 --> B5["분실 기간 + 구역 또는 잘 모르겠어요"]
    B5 --> B6["P-03 3단계: 연락처와 확인"]
    B6 --> B7["이메일 또는 전화 중 하나 이상, 이름 선택, 나만 아는 특징 선택, 개인정보 동의 필수"]
    B7 --> B8{"입력 검증 통과?"}
    B8 -->|"아니오"| B6
    B8 -->|"예"| B9["제출 → 신고 저장, 토큰 발급"]
    B9 --> B10["P-04로 이동, 링크 저장 안내 배너"]
    B9 -.->|"응답 후 백그라운드"| B11["AI 정규화 → 임베딩 → 매칭 Flow C"]
    B9 -.->|"이메일 있으면"| B12["신고 링크 이메일 발송"]
```

규칙
- 단계 이동 시 입력값을 유지한다 (뒤로 가기 해도 지워지지 않음).
- 3단계의 "나만 아는 특징"은 "케이스 안쪽 스티커, 이니셜처럼 남은 모르는 특징을 적어주세요. 관리자만 볼 수 있어요." 안내를 붙인다.

## 4. Flow C — 매칭 (시스템)

두 가지 계기로 실행된다: 신고 저장 직후, 습득물 저장 직후. 계산식은 `05-ai-matching.md`.

```mermaid
sequenceDiagram
    autonumber
    participant U as 분실자 브라우저
    participant S as Next.js 서버
    participant AI as Claude API
    participant E as 임베딩 API
    participant DB as Supabase
    U->>S: 신고 제출
    S->>DB: lost_reports 저장 (status open)
    S-->>U: 토큰 반환, P-04 이동
    Note over S: 여기부터 응답 후 백그라운드
    S->>AI: 설명 문장 → 구조화 (분류, 색상, 특징)
    AI-->>S: ItemDescriptor JSON
    S->>E: search_text 임베딩
    E-->>S: vector 1536
    S->>DB: lost_reports 업데이트 (descriptor, embedding)
    S->>DB: RPC match_items_for_report: 후보 20개
    DB-->>S: 후보 + 벡터 유사도
    S->>S: score.ts로 최종 점수 계산
    S->>DB: match_candidates upsert (0.45 이상, 최대 5개)
    alt 0.70 이상 새 후보 있음 + 이메일 있음
        S->>U: 이메일: 비슷한 물건이 있어요
    end
```

습득물 등록 시(역방향)도 같은 순서다. 차이: AI 분석은 등록 화면에서 이미 끝났으므로 임베딩부터 시작하고, RPC는 `match_reports_for_item`을 쓴다.

## 5. Flow D — 후보 확인과 소유권 확인 요청 (분실자)

```mermaid
flowchart TD
    D0(["신고 링크 P-04 진입"]) --> D1{"AI 분석 끝났나?"}
    D1 -->|"아직"| D2["찾는 중이에요 + 자동 새로고침 5초"]
    D2 --> D1
    D1 -->|"끝남"| D3{"후보 있음?"}
    D3 -->|"없음"| D4["아직 비슷한 물건이 없어요. 새로 들어오면 알려드릴게요"]
    D3 -->|"있음"| D5["후보 카드: 분류, 공개 설명, 습득일, 구역, 유사도 높음/보통"]
    D5 -->|"내 물건이 아니에요"| D6["후보 숨김, status dismissed"]
    D5 -->|"내 물건 같아요"| D7["P-05 소유권 확인 요청"]
    D7 --> D8["질문: 공개 설명에 없는 특징을 적어주세요 + 사진 첨부 선택"]
    D8 --> D9["제출 → status claimed"]
    D9 --> D10["P-04: 관리자가 확인 중이에요"]
    D10 --> D11{"관리자 결정"}
    D11 -->|"승인"| D12["수령 안내 표시 + 이메일"]
    D11 -->|"거절"| D13["확인되지 않았어요 안내 + 다른 후보 계속 보기"]
```

규칙
- 한 신고에서 동시에 진행 중인 소유권 확인 요청은 1개만 허용한다 (무작위 요청 방지).
- 거절 사유는 분실자에게 자세히 보여주지 않는다 ("확인되지 않았어요. 궁금하면 시설로 문의해 주세요"). 비공개 특징이 새지 않게 하기 위해서다.

## 6. Flow E — 소유권 검토와 반환 (관리자)

```mermaid
flowchart TD
    E0(["A-02 대시보드: 검토 대기 n건"]) --> E1["A-06 요청 상세"]
    E1 --> E2["왼쪽: 분실자 원문 설명, 나만 아는 특징, 요청 답변, 첨부 사진"]
    E1 --> E3["오른쪽: 습득물 사진, 공개 설명, 비공개 특징"]
    E2 --> E4{"일치하나?"}
    E3 --> E4
    E4 -->|"일치"| E5["승인 + 메모"]
    E4 -->|"불일치"| E6["거절 + 내부 메모"]
    E4 -->|"애매함"| E7["연락처로 직접 확인 후 결정"]
    E7 --> E4
    E5 --> E8["분실자에게 수령 안내 발송"]
    E8 --> E9["분실자 방문 또는 수령"]
    E9 --> E10["A-09 반환 처리: 수령인 이름, 확인 방법, 메모"]
    E10 --> E11["습득물 returned, 신고 resolved, 같은 습득물의 다른 후보 dismissed"]
    E6 --> E12["후보 rejected, 습득물 stored로 복귀, 신고 open으로 복귀"]
```

확인 방법 선택지: `신분증 확인`, `특징 문답`, `구매 내역`, `기타`.

## 7. Flow F — 전화·방문 문의 대응 (관리자)

관리자의 반복 문의 응대 시간을 줄이는 흐름.

```mermaid
flowchart TD
    F0(["전화 또는 방문: 이어폰 잃어버렸어요"]) --> F1["A-04에서 자연어 검색: 검은 이어폰 은색 키링"]
    F1 --> F2{"결과에 있나?"}
    F2 -->|"있음"| F3["A-05 상세에서 비공개 특징 질문으로 확인"]
    F3 --> F4["A-09 반환 처리"]
    F2 -->|"없음"| F5["A-07 대리 신고 접수: 연락처 받아서 등록"]
    F5 --> F6["분실자에게 신고 링크 문자·구두 안내"]
    F6 --> F7["이후 새 습득물 들어오면 자동 매칭 Flow C"]
```

## 8. Flow G — 습득자

MVP에서는 안내만 한다. 습득자의 직접 등록은 P2.

```mermaid
flowchart LR
    G0(["물건을 주움"]) --> G1["시설 QR 스캔 P-02"]
    G1 -->|"물건을 주웠어요"| G2["P-06: 맡기는 곳, 운영 시간, 지도 안내"]
    G2 --> G3["안내데스크에 전달"]
    G3 --> G4["Flow A"]
```

## 9. 상태 다이어그램

코드의 enum 값과 반드시 같아야 한다.

### 9-1. 습득물 `found_items.status`

```mermaid
stateDiagram-v2
    state "보관 중" as stored
    state "소유권 확인 중" as claimed
    state "반환 완료" as returned
    state "경찰 이관" as transferred
    state "폐기·기타 처리" as disposed
    [*] --> stored: 등록
    stored --> claimed: 분실자 확인 요청
    claimed --> stored: 관리자 거절
    claimed --> returned: 승인 후 반환 처리
    stored --> returned: 방문 문의로 직접 반환
    stored --> transferred: 이관 처리
    stored --> disposed: 폐기 처리
    returned --> [*]
    transferred --> [*]
    disposed --> [*]
```

화면의 "매칭 후보 n건" 배지는 상태가 아니라 `match_candidates` 개수로 계산한다.

### 9-2. 분실 신고 `lost_reports.status`

```mermaid
stateDiagram-v2
    state "찾는 중" as open
    state "확인 요청 중" as claimed
    state "반환 완료" as resolved
    state "종료" as closed
    [*] --> open: 신고 제출
    open --> claimed: 확인 요청 제출
    claimed --> open: 관리자 거절
    claimed --> resolved: 반환 완료
    open --> closed: 분실자 취소 또는 기간 만료
    resolved --> [*]
    closed --> [*]
```

기간 만료(신고 후 30일, P1 자동화)는 `closed`로 바꾸고 연락처를 삭제한다.

### 9-3. 매칭 후보 `match_candidates.status`

```mermaid
stateDiagram-v2
    state "추천됨" as suggested
    state "확인 요청" as claimed
    state "승인" as approved
    state "거절" as rejected
    state "숨김" as dismissed
    [*] --> suggested: 매칭 엔진
    suggested --> claimed: 분실자 내 물건 같아요
    suggested --> dismissed: 분실자 아니에요 또는 습득물이 다른 사람에게 반환됨
    claimed --> approved: 관리자 승인
    claimed --> rejected: 관리자 거절
    approved --> [*]
    rejected --> [*]
    dismissed --> [*]
```

`dismissed` 사유는 `breakdown.dismiss_reason`에 남긴다: `user`, `item_returned`, `report_closed`.

## 10. 예외 케이스

| 상황 | 처리 |
|---|---|
| AI 분석 실패·시간 초과 (등록) | 빈 양식으로 수동 입력. 저장은 가능. 임베딩은 관리자가 입력한 텍스트로 만든다. |
| AI 분석 실패 (신고) | 원문 설명 그대로 임베딩해서 매칭. `ai_status = 'failed'`로 표시, 관리자 화면에 경고. |
| AI가 요청을 거부 (`stop_reason: refusal`) | 위와 같이 처리. 거부 사유는 로그에만 남긴다. |
| 신고 링크 분실 | MVP: 시설에 전화 → 관리자가 A-07에서 찾아 링크 재전달. P1: 이메일로 링크 재발송. |
| 같은 습득물에 여러 사람이 확인 요청 | 모두 받되 관리자 화면에 "다른 요청 n건" 경고. 하나를 승인하면 나머지는 자동 거절 대기. |
| 분실자가 물건을 다른 곳에서 찾음 | 신고 취소 버튼 → `closed`, 후보 모두 `dismissed`. |
| 신고는 왔는데 시설이 틀림 | MVP: 같은 시설만 매칭. P1: 같은 지역 시설까지 확장. |
| 민감 물품 (신분증 등) | 후보 카드에 분류만 표시 ("신분증·학생증"). 공개 설명에도 이름·번호 없음. |
| 습득 일시가 분실 기간보다 이전 | 매칭 후보에서 제외 (하루 오차 허용). |
| 보관 기한 임박 | 대시보드 할 일에 표시 (P1: 이메일 알림). |
