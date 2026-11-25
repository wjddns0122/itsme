import Image from "next/image";
import Link from "next/link";
import ko from "../../../messages/ko.json";

const t = ko.public.facility;

/** P-02 error (Figma "에러 (없는 시설 주소)"): unknown slug. */
export function FacilityNotFound() {
  return <FacilityMessage message={t.notFound} actionLabel={t.searchAgain} actionHref="/" />;
}

/** The facility could not be loaded (database error). */
export function FacilityLoadError({ retryHref }: { retryHref: string }) {
  return <FacilityMessage message={t.error} actionLabel={t.retry} actionHref={retryHref} />;
}

function FacilityMessage({ message, actionLabel, actionHref }: { message: string; actionLabel: string; actionHref: string }) {
  return (
    <section role="alert" className="flex flex-col items-center gap-3 pt-20 text-center">
      <Image src="/brand/mascot-curious.png" alt="" width={150} height={114} className="h-[114px] w-[150px] object-contain" />
      <p className="text-section font-bold tracking-[-0.01em] text-ink">{message}</p>
      <Link
        href={actionHref}
        className="flex h-11 items-center rounded-ui-sm bg-brand px-4 text-button font-bold text-on-brand"
      >
        {actionLabel}
      </Link>
    </section>
  );
}

/** Loading skeleton in the shape of the facility hero and the two big buttons. */
export function FacilityLoading() {
  return (
    <div role="status" className="flex flex-col gap-4">
      <span className="sr-only">{t.loading}</span>
      <span aria-hidden className="size-12 animate-pulse rounded-ui-sm bg-blush" />
      <span aria-hidden className="h-7 w-3/4 animate-pulse rounded-ui-sm bg-line" />
      <span aria-hidden className="h-4 w-1/3 animate-pulse rounded-ui-sm bg-line" />
      <span aria-hidden className="h-15 animate-pulse rounded-ui-lg bg-blush" />
      <span aria-hidden className="h-15 animate-pulse rounded-ui-lg bg-line" />
    </div>
  );
}
