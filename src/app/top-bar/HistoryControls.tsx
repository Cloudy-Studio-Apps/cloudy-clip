import { Redo2, Undo2 } from "lucide-react";
import { useHistory, useKernel } from "@/core";
import { IconButton } from "@/ui";

/** Undo and redo over the shared history, so an agent's edit can be undone like any other. */
export function HistoryControls() {
  const { bus } = useKernel();
  const history = useHistory();

  return (
    <>
      <IconButton
        label={history.undoLabel ? `Undo ${history.undoLabel} (Ctrl+Z)` : "Undo (Ctrl+Z)"}
        disabled={!history.canUndo}
        onClick={() => void bus.execute("history.undo", {})}
      >
        <Undo2 />
      </IconButton>
      <IconButton
        label={
          history.redoLabel ? `Redo ${history.redoLabel} (Ctrl+Shift+Z)` : "Redo (Ctrl+Shift+Z)"
        }
        disabled={!history.canRedo}
        onClick={() => void bus.execute("history.redo", {})}
      >
        <Redo2 />
      </IconButton>
    </>
  );
}
