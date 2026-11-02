import { HardDrive } from "lucide-react";
import { useEffect, useState } from "react";
import { useModule } from "@/core";
import { mediaRef } from "../media.ref";
import type { DiskInfo } from "../media.types";
import { usePickMedia } from "./media.pick.hook";
import { TreeRow } from "./SmartBinList";

/** What's mounted. A click opens the file picker there. */
export function DiskList() {
  const media = useModule(mediaRef);
  const pickMedia = usePickMedia();
  const [disks, setDisks] = useState<readonly DiskInfo[]>([]);
  useEffect(() => {
    let live = true;
    media.listDisks().then(
      (list) => live && setDisks(list ?? []),
      () => live && setDisks([]),
    );
    return () => {
      live = false;
    };
  }, [media]);
  return (
    <section className="flex min-h-0 flex-[0_0_30%] flex-col border-b border-border-strong">
      <h2 className="flex h-8 shrink-0 items-center px-3 font-hand text-[13.5px] font-bold">
        Disks
      </h2>
      <div className="min-h-0 flex-1 overflow-y-auto pb-1.5">
        {disks.map(({ name, mountPoint }) => (
          <TreeRow
            key={mountPoint}
            icon={HardDrive}
            label={name}
            active={false}
            onClick={() => void pickMedia({ defaultPath: mountPoint })}
          />
        ))}
      </div>
    </section>
  );
}
