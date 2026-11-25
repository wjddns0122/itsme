import ko from "../../../messages/ko.json";

// P-01 서비스 소개 (최소). 디자인 확정 후 교체: docs/03-screens.md
export default function HomePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-3 px-4 py-16">
      <p className="text-sm font-medium text-muted-foreground">{ko.app.name}</p>
      <h1 className="text-2xl font-semibold">{ko.public.home.title}</h1>
      <p className="text-muted-foreground">{ko.public.home.description}</p>
      <p className="pt-6 text-xs text-muted-foreground">{ko.app.slogan}</p>
    </main>
  );
}
