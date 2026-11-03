import { StripLabel } from "./StripLabel";

/** Where a strip goes, under "Sends to", in mono over a rule: `Master` for a track, `Output 1-2` for the master. */
export function SendsTo({ to }: { to: string }) {
  return (
    <>
      <StripLabel>Sends to</StripLabel>
      <div className="truncate border-b border-border-strong font-mono text-sm text-muted-foreground">
        {to}
      </div>
    </>
  );
}
