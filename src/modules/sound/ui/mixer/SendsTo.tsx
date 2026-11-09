import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { MenuList, Popover, type MenuItem } from "@/ui";
import { StripLabel } from "./StripLabel";

const VALUE = "truncate border-b border-border-strong font-mono text-sm text-muted-foreground";

interface SendsToProps {
  /** Where it goes: `Master` or a group's name for a track, `Master` for a group, `Output 1-2` for the master. */
  to: string;
  /** The places it can go instead; with them, the value opens a menu of them. */
  items?: readonly MenuItem[];
}

/** Where a strip goes, under "Sends to", in mono over a rule; a menu when it can go elsewhere. */
export function SendsTo({ to, items }: SendsToProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <StripLabel>Sends to</StripLabel>
      {items ? (
        <Popover
          open={open}
          onOpenChange={setOpen}
          trigger={
            <button
              type="button"
              title={`Sends to ${to}. Click to send it elsewhere.`}
              className={`${VALUE} flex w-full cursor-pointer items-center gap-0.5 text-left hover:text-foreground`}
            >
              <span className="min-w-0 flex-1 truncate">{to}</span>
              <ChevronDown aria-hidden className="size-3 shrink-0" />
            </button>
          }
        >
          <MenuList items={items} onClose={() => setOpen(false)} />
        </Popover>
      ) : (
        <div className={VALUE}>{to}</div>
      )}
    </>
  );
}
