import type { InfoRow } from "./kit.types";

/** Label/value pairs in two columns; values in mono so numbers line up. */
export function InfoList({ rows }: { rows: readonly InfoRow[] }) {
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {rows.map(({ label, value }) => (
        <div key={label} className="contents">
          <dt className="text-subtle-foreground">{label}</dt>
          <dd className="m-0 truncate font-mono" title={value}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
