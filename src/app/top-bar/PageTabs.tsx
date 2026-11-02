import { useMemo } from "react";
import { useStore } from "zustand";
import { appPages, EDITOR_PAGE, pagesRef, showPage, useKernel, useModule, usePoint } from "@/core";
import { SegmentedControl } from "@/ui";

/** Edit and the pages modules add. Hidden while the editor is alone. */
export function PageTabs() {
  const { bus } = useKernel();
  const pages = usePoint(appPages);
  const active = useStore(useModule(pagesRef).store, (state) => state.active);
  const options = useMemo(
    () => [
      { value: EDITOR_PAGE, label: "Edit" },
      ...[...pages]
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(({ id, label }) => ({ value: id, label })),
    ],
    [pages],
  );
  if (pages.length === 0) return null;
  return (
    <SegmentedControl
      label="Page"
      options={options}
      value={active}
      onChange={(page) => void bus.run(showPage, { page })}
      className="mr-2"
    />
  );
}
