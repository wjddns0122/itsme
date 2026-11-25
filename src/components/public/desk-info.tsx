import { deskInfoRows, type PublicFacilityPage } from "@/lib/facilities/page-data";

type Labels = Record<"desk" | "contact" | "hours", string>;

/** Desk location, phone and hours card (Figma "desk-info"). Renders nothing when the facility left them empty. */
export function DeskInfo({ facility, labels }: { facility: PublicFacilityPage; labels: Labels }) {
  const rows = deskInfoRows(facility);
  if (rows.length === 0) return null;

  return (
    <dl className="flex flex-col gap-2 rounded-ui-md border border-line bg-surface p-3.5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start gap-2.5">
          <dt className="w-[84px] shrink-0 text-caption font-medium text-ink-muted">{labels[row.label]}</dt>
          <dd className="min-w-0 flex-1 text-label font-bold text-ink">
            <PhoneAware value={row.value} phone={facility.contactPhone} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Makes the phone number tappable on phones without changing how the row looks. */
function PhoneAware({ value, phone }: { value: string; phone: string | null }) {
  if (!phone || !value.includes(phone)) return value;
  const [before, after] = value.split(phone);
  return (
    <>
      {before}
      <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="underline-offset-2 hover:underline">
        {phone}
      </a>
      {after}
    </>
  );
}
