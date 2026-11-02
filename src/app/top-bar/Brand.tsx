import { useMemo, useState } from "react";
import {
  appMenuItems,
  appPageGroups,
  appPages,
  keybindings,
  showPage,
  useKernel,
  usePoint,
} from "@/core";
import { MenuList, Popover, SealMark } from "@/ui";
import { buildAppMenu } from "./app.menu";

/** What the menu lists, read when it opens so enabled entries are current. */
function AppMenu({ onClose }: { onClose(): void }) {
  const { bus } = useKernel();
  const items = usePoint(appMenuItems);
  const bindings = usePoint(keybindings);
  const pages = usePoint(appPages);
  const groups = usePoint(appPageGroups);
  const menu = useMemo(
    () =>
      buildAppMenu({
        items,
        bindings,
        pages,
        groups,
        execute: ({ command, input }) => void bus.execute(command, input),
        showPage: (page) => void bus.run(showPage, { page }),
      }),
    [bus, items, bindings, pages, groups],
  );
  return <MenuList items={menu} onClose={onClose} />;
}

/** The foca watona and the app's wordmark. A click opens the app's menu. */
export function Brand() {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          title="Menu"
          aria-label="Cloudy Clip menu"
          className="flex shrink-0 cursor-pointer items-center gap-2 rounded-[3px] pr-1 hover:bg-hover"
        >
          <SealMark className="h-[30px] w-9" />
          <span className="font-hand text-display font-extrabold leading-none tracking-[-0.01em]">
            cloudy clip
          </span>
        </button>
      }
    >
      <AppMenu onClose={() => setOpen(false)} />
    </Popover>
  );
}
