import { useEffect } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { Dialog } from "@/ui";
import { workspaceRef } from "../workspace.ref";
import { AllProjects } from "./AllProjects";
import { NewProjectColumn } from "./NewProjectColumn";
import { RecentColumn } from "./RecentColumn";

/** The start dialog: new project on the left, recent ones on the right, or all of them. */
export function StartDialogHost() {
  const { ui, recents } = useModule(workspaceRef);
  const start = useStore(ui, (s) => s.start);

  useEffect(() => {
    if (start !== "hidden") void recents.refresh();
  }, [start, recents]);

  if (start === "hidden") return null;
  return (
    <Dialog title="Cloudy Clip" size="wide" onClose={() => ui.setState({ start: "hidden" })}>
      {start === "all" ? (
        <AllProjects />
      ) : (
        <div className="grid min-h-[340px] grid-cols-[220px_1fr] gap-4">
          <NewProjectColumn />
          <RecentColumn />
        </div>
      )}
    </Dialog>
  );
}
