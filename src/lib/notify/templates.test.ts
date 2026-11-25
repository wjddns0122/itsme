import { describe, expect, it } from "vitest";
import { approvedEmail, escapeHtml, newCandidatesEmail, reportReceivedEmail } from "./templates";

const link = "https://itsme.example/r/abc";

describe("email templates", () => {
  it("신고 접수 메일에 시설 이름과 신고 링크가 들어간다", () => {
    const mail = reportReceivedEmail({ facilityName: "평창 ○○ 스키장 (예시)", link });
    expect(mail.subject).toContain("신고했어요");
    expect(mail.text).toContain("평창 ○○ 스키장 (예시)");
    expect(mail.html).toContain(link);
  });

  it("후보 메일은 공개 정보만 쓰고, 민감 물품은 분류만 쓴다", () => {
    const mail = newCandidatesEmail({
      facilityName: "시설",
      link,
      items: [
        { category: "이어폰·헤드폰", summary: "흰색 무선 이어폰", foundDate: "11월 24일", foundArea: "렌탈샵" },
        { category: "신분증·학생증", summary: null, foundDate: null, foundArea: null },
      ],
    });
    expect(mail.text).toContain("흰색 무선 이어폰 · 습득 11월 24일 · 렌탈샵");
    expect(mail.text).toContain("• 신분증·학생증");
    for (const banned of ["private", "score", "0.8", "M.K"]) expect(mail.text).not.toContain(banned);
  });

  it("승인 메일은 있는 수령 정보만 적는다", () => {
    const mail = approvedEmail({ facilityName: "시설", link, pickup: { desk: "안내데스크", hours: null, bring: "신분증", contact: null, note: "오전에 오세요" } });
    expect(mail.text).toContain("장소: 안내데스크");
    expect(mail.text).toContain("지참물: 신분증");
    expect(mail.text).not.toContain("운영 시간");
  });

  it("사람이 쓴 글은 HTML로 해석되지 않게 이스케이프한다", () => {
    expect(escapeHtml(`<script>"x"</script>`)).toBe("&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
    const mail = approvedEmail({ facilityName: "시설", link, pickup: { desk: null, hours: null, bring: null, contact: null, note: "<b>굵게</b>" } });
    expect(mail.html).not.toContain("<b>굵게</b>");
  });
});
