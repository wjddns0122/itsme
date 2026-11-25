// A-02 대시보드. KPI·할 일 목록은 FL-060에서 채운다 (로그인 확인은 proxy와 공통 레이아웃이 한다).
import ko from "../../../../messages/ko.json";

export default function AdminDashboardPage() {
  return (
    <main className="flex flex-col gap-5 px-4 pt-6 pb-8 md:px-6">
      <h1 className="text-page font-bold tracking-[-0.01em] text-ink">{ko.admin.home.title}</h1>
      <p className="text-desc text-ink-muted">{ko.admin.home.description}</p>
    </main>
  );
}
