import type { ReactNode } from "react";

/** The small caption over a part of a strip ("Sends to", "Pan"). */
export function StripLabel({ children }: { children: ReactNode }) {
  return <span className="text-xs leading-none text-subtle-foreground">{children}</span>;
}
