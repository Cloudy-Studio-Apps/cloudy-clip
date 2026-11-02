import { useMemo } from "react";
import { useStore } from "zustand";
import {
  appPageGroups,
  appPages,
  groupPages,
  pagesRef,
  showPage,
  useKernel,
  useModule,
  usePoint,
} from "@/core";
import { SegmentedControl } from "@/ui";

/** A tab for every page modules contribute, in order, with a divider between groups. */
export function PageTabs() {
  const { bus } = useKernel();
  const pages = usePoint(appPages);
  const groups = usePoint(appPageGroups);
  const active = useStore(useModule(pagesRef).store, (state) => state.active);
  const options = useMemo(
    () =>
      groupPages(pages, groups).flatMap((group, groupIndex) =>
        group.map(({ id, label, icon }, index) => ({
          value: id,
          label,
          icon,
          divided: groupIndex > 0 && index === 0,
        })),
      ),
    [pages, groups],
  );
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
