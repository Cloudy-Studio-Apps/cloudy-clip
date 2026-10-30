import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { Button, EmptyState } from "@/ui";
import { askOpen } from "../workspace.commands";
import { workspaceRef } from "../workspace.ref";
import { RecentRow } from "./RecentRow";

const SHOWN = 6;

/** The latest projects, and the ways to the others. */
export function RecentColumn() {
  const { bus } = useKernel();
  const { ui, recents } = useModule(workspaceRef);
  const items = useStore(recents.store, (s) => s.items);
  const gone = useStore(recents.store, (s) => s.gone);

  return (
    <section className="flex min-w-0 flex-col gap-1">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Recent</h3>
        <button
          type="button"
          className="cursor-pointer text-xs text-muted-foreground hover:text-foreground"
          onClick={() => ui.setState({ start: "all" })}
        >
          Show all
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No projects yet">What you make here shows up in this list.</EmptyState>
      ) : (
        items
          .slice(0, SHOWN)
          .map((project) => (
            <RecentRow key={project.path} project={project} gone={gone.includes(project.path)} />
          ))
      )}
      <Button size="sm" className="mt-auto self-start" onClick={() => void bus.run(askOpen, {})}>
        Open file…
      </Button>
    </section>
  );
}
