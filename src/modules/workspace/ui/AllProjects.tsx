import { ArrowLeft, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { IconButton } from "@/ui";
import { workspaceRef } from "../workspace.ref";
import { RecentRow } from "./RecentRow";

/** Every project opened here, with search. Removing one leaves its file alone. */
export function AllProjects() {
  const { ui, recents } = useModule(workspaceRef);
  const items = useStore(recents.store, (s) => s.items);
  const gone = useStore(recents.store, (s) => s.gone);
  const [search, setSearch] = useState("");

  const shown = useMemo(() => {
    const text = search.trim().toLowerCase();
    return items.filter(({ name }) => name.toLowerCase().includes(text));
  }, [items, search]);

  return (
    <section className="flex h-[400px] flex-col gap-2">
      <div className="flex items-center gap-2">
        <IconButton label="Back" onClick={() => ui.setState({ start: "home" })}>
          <ArrowLeft className="size-4" />
        </IconButton>
        <input
          autoFocus
          value={search}
          placeholder="Search projects"
          aria-label="Search projects"
          className="min-w-0 flex-1 rounded-sm border border-border bg-surface-sunken px-2 py-1 text-sm outline-none focus:border-ring"
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {shown.map((project) => (
          <RecentRow
            key={project.path}
            project={project}
            gone={gone.includes(project.path)}
            action={
              <IconButton label="Remove from list" onClick={() => recents.remove(project.path)}>
                <X className="size-3.5" />
              </IconButton>
            }
          />
        ))}
        {shown.length === 0 && (
          <p className="p-3 text-center text-sm text-muted-foreground">No project matches.</p>
        )}
      </div>
    </section>
  );
}
