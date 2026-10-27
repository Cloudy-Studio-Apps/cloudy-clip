import { Plus } from "lucide-react";
import { Button } from "@/ui";
import { usePickMedia } from "./media.pick.hook";

/** The panel's title row: how many items there are and the Import button. */
export function MediaHeader({ count }: { count: number }) {
  const pickMedia = usePickMedia();
  return (
    <div className="flex items-center justify-between gap-1.5">
      <h2 className="text-xs font-semibold uppercase tracking-[0.04em] text-subtle-foreground">
        Media
        {count > 0 && <span className="ml-1.5 font-normal normal-case">· {count}</span>}
      </h2>
      <Button variant="primary" size="sm" title="Import files" onClick={() => void pickMedia()}>
        <Plus />
        Import
      </Button>
    </div>
  );
}
