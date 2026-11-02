import { useStore } from "zustand";
import type { ReactNode } from "react";
import { useModule } from "@/core";
import { FoldSection } from "@/ui";
import { inspectorRef } from "../inspector.ref";

interface InspectorSectionProps {
  title: string;
  /** Remembers whether it is folded; the title by default. */
  foldKey?: string;
  /** Drawn left of the title: a group's switch. */
  leading?: ReactNode;
  /** Drawn at the right of the band; clicking them doesn't fold. */
  actions?: ReactNode;
  children?: ReactNode;
}

/** A folding section of the inspector; which ones are folded lives in the inspector's view store. */
export function InspectorSection({
  title,
  foldKey,
  leading,
  actions,
  children,
}: InspectorSectionProps) {
  const view = useModule(inspectorRef).view;
  const key = foldKey ?? title;
  const folded = useStore(view.store, (s) => s.folded.includes(key));
  return (
    <FoldSection
      title={title}
      open={!folded}
      onToggle={() => view.toggleFold(key)}
      leading={leading}
      actions={actions}
    >
      {children}
    </FoldSection>
  );
}
