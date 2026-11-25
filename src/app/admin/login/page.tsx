// A-01 로그인
import Image from "next/image";
import { Suspense } from "react";
import { AppIcon } from "@/components/app-icon";
import { LOGIN_ERROR_NO_FACILITY } from "@/lib/admin/routes";
import ko from "../../../../messages/ko.json";
import { LoginForm } from "./login-form";

export default function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  return (
    <main className="flex flex-1 items-center justify-center bg-canvas px-4 py-10">
      <div className="relative w-full max-w-[400px] pt-[76px]">
        <div className="flex flex-col gap-4 rounded-ui-lg border-[1.5px] border-line-strong bg-surface p-7 shadow-pop">
          <div className="flex items-center gap-2.5">
            <AppIcon size="lg" />
            <h1 className="font-brand text-character text-ink">{ko.admin.login.title}</h1>
          </div>
          {/* searchParams is request data, so the notice resolves behind a boundary. */}
          <Suspense fallback={<LoginForm notice={null} />}>
            <LoginFormWithNotice searchParams={searchParams} />
          </Suspense>
        </div>
        {/* After the card so the mascot's paws sit on top of its border, as in Figma. */}
        <Image
          src="/brand/mascot-peek.png"
          alt=""
          width={190}
          height={82}
          priority
          className="absolute top-1 right-6 h-[82px] w-[190px] object-contain"
        />
      </div>
    </main>
  );
}

async function LoginFormWithNotice({ searchParams }: Pick<PageProps<"/admin/login">, "searchParams">) {
  const { error } = await searchParams;
  return <LoginForm notice={error === LOGIN_ERROR_NO_FACILITY ? ko.admin.login.errorNoFacility : null} />;
}
