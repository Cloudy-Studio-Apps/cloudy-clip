import { formatDuration, formatSize } from "../logic/estimate";

interface ExportFactsProps {
  bytes: number;
  seconds: number;
  length: number;
  free: number | null;
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 px-3.5 pb-2.5 pt-[9px] [&+&]:border-l [&+&]:border-border">
      <div className="truncate font-mono text-lg font-bold leading-[1.1]">{value}</div>
      <div className="truncate text-sm text-subtle-foreground">{label}</div>
    </div>
  );
}

/** What the export will cost. */
export function ExportFacts({ bytes, seconds, length, free }: ExportFactsProps) {
  return (
    <div className="grid shrink-0 grid-cols-4 border-t border-border-strong bg-surface">
      <Fact value={`~${formatSize(bytes)}`} label="Estimated file size" />
      <Fact value={`~${formatDuration(seconds)}`} label="Estimated export time" />
      <Fact value={formatDuration(length)} label="Video length" />
      <Fact value={free === null ? "—" : formatSize(free)} label="Free on this disk" />
    </div>
  );
}
