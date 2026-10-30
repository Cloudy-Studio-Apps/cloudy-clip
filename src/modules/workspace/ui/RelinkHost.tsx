import { useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { mediaRef, useLocateMedia } from "@/modules/media";
import { projectRef } from "@/modules/project";
import { Button, Dialog } from "@/ui";
import { workspaceRef } from "../workspace.ref";

/** The files an opened project couldn't find. Closes once they're all back. */
export function RelinkHost() {
  const { ui } = useModule(workspaceRef);
  const open = useStore(ui, (s) => s.relink);
  return open ? <RelinkDialog /> : null;
}

function RelinkDialog() {
  const { ui } = useModule(workspaceRef);
  const media = useModule(mediaRef);
  const { store } = useModule(projectRef);
  const probes = useStore(media.probes, (s) => s.probes);
  const assets = useStore(store.api, (s) => s.media);
  const locate = useLocateMedia();

  const missing = useMemo(
    () => Object.values(assets).filter(({ id }) => probes[id]?.status === "missing"),
    [assets, probes],
  );
  const close = () => ui.setState({ relink: false });

  useEffect(() => {
    if (missing.length === 0) ui.setState({ relink: false });
  }, [missing.length, ui]);

  return (
    <Dialog
      title="Some files have moved"
      onClose={close}
      footer={<Button onClick={close}>Skip</Button>}
    >
      <p className="text-sm text-muted-foreground">
        Locate them and their clips come back. Files in the same folder are found together.
      </p>
      {missing.map((asset) => (
        <div key={asset.id} className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-sm" title={asset.path}>
            {asset.name}
          </span>
          <Button size="sm" onClick={() => void locate(asset)}>
            Locate…
          </Button>
        </div>
      ))}
    </Dialog>
  );
}
