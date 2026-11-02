import { formatDuration, formatSize } from "../logic/estimate";

interface ExportFactsProps {
  bytes: number;
  seconds: number;
  length: number;
  free: number | null;
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-surface px-2.5 py-2">
      <div className="truncate font-mono text-base font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** What the export will cost. */
export function ExportFacts({ bytes, seconds, length, free }: ExportFactsProps) {
  return (
    <div className="grid shrink-0 grid-cols-4 gap-2">
      <Fact value={`~${formatSize(bytes)}`} label="Estimated file size" />
      <Fact value={`~${formatDuration(seconds)}`} label="Estimated export time" />
      <Fact value={formatDuration(length)} label="Video length" />
      <Fact value={free === null ? "—" : formatSize(free)} label="Free on this disk" />
    </div>
  );
}
