// A-07 "같은 분 신고 n건": rows of one page grouped by contact_key, in the order they appear.
// Pure, so the grouping rule is tested without a database.

export type GroupableRow = { id: string; contactKey: string | null; contactName: string | null; createdAt: string };

export type ReportGroup<R extends GroupableRow> = {
  /** null for a person with a single report: rendered as a plain row without a header. */
  key: string | null;
  name: string | null;
  /** Reports of this person in the facility, not only on this page. */
  total: number;
  latest: string;
  rows: R[];
};

export function groupReports<R extends GroupableRow>(rows: readonly R[], totals: ReadonlyMap<string, { count: number; latest: string }>): ReportGroup<R>[] {
  const groups: ReportGroup<R>[] = [];
  const byKey = new Map<string, ReportGroup<R>>();
  for (const row of rows) {
    const person = row.contactKey ? totals.get(row.contactKey) : undefined;
    if (!row.contactKey || !person || person.count < 2) {
      groups.push({ key: null, name: row.contactName, total: 1, latest: row.createdAt, rows: [row] });
      continue;
    }
    let group = byKey.get(row.contactKey);
    if (!group) {
      group = { key: row.contactKey, name: row.contactName, total: person.count, latest: person.latest, rows: [] };
      byKey.set(row.contactKey, group);
      groups.push(group);
    }
    group.name ??= row.contactName;
    group.rows.push(row);
  }
  return groups;
}
