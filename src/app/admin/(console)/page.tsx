import ko from "../../../messages/ko.json";

// A-02 대시보드 자리. 로그인·레이아웃은 FL-003, KPI는 FL-060
export default function AdminHomePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-2 px-6 py-10">
      <h1 className="text-xl font-semibold">{ko.admin.home.title}</h1>
      <p className="text-muted-foreground">{ko.admin.home.description}</p>
    </main>
  );
}
