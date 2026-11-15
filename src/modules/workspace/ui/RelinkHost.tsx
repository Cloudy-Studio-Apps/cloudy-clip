import { useCallback, useEffect, useState } from "react";
import { useStore } from "zustand";
import { useModule, usePoint } from "@/core";
import { Button, Dialog } from "@/ui";
import { relinkKinds } from "../workspace.points";
import { workspaceRef } from "../workspace.ref";
import type { RelinkKind } from "../workspace.types";

/** The files an opened project couldn't find, of every kind in `relinkKinds`. Closes once they're all back. */
export function RelinkHost() {
  const { ui } = useModule(workspaceRef);
  const open = useStore(ui, (s) => s.relink);
  return open ? <RelinkDialog /> : null;
}

function RelinkDialog() {
  const { ui } = useModule(workspaceRef);
  const kinds = usePoint(relinkKinds);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const close = () => ui.setState({ relink: false });

  const reported = kinds.every(({ id }) => counts[id] !== undefined);
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  useEffect(() => {
    if (reported && total === 0) ui.setState({ relink: false });
  }, [reported, total, ui]);

  return (
    <Dialog
      title="Some files have moved"
      onClose={close}
      footer={<Button onClick={close}>Skip</Button>}
    >
      <p className="text-sm text-muted-foreground">
        Locate them and what uses them comes back. Files in the same folder are found together.
      </p>
      {[...kinds]
        .sort((a, b) => a.order - b.order)
        .map((kind) => (
          <KindRows key={kind.id} kind={kind} setCounts={setCounts} />
        ))}
    </Dialog>
  );
}

function KindRows({
  kind,
  setCounts,
}: {
  kind: RelinkKind;
  setCounts: (update: (counts: Record<string, number>) => Record<string, number>) => void;
}) {
  const onCount = useCallback(
    (count: number) => setCounts((counts) => ({ ...counts, [kind.id]: count })),
    [kind.id, setCounts],
  );
  const Rows = kind.component;
  return <Rows onCount={onCount} />;
}
