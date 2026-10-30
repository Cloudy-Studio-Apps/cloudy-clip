import { useState } from "react";
import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { Popover, cn } from "@/ui";
import { askOpen, askSaveAs, renameProject, saveProject, showStart } from "../workspace.commands";
import { workspaceRef } from "../workspace.ref";
import { DescriptionField } from "./DescriptionField";
import type { SaveStatus } from "../workspace.types";

const STATUS: Record<SaveStatus, string> = {
  blank: "",
  saved: "Saved",
  saving: "Saving…",
  failed: "Not saved",
};

/** The project's name and whether it's saved, opening the file actions. */
export function ProjectTitle() {
  const { bus } = useKernel();
  const { session } = useModule(workspaceRef);
  const name = useStore(session, (s) => s.name);
  const status = useStore(session, (s) => s.status);
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);
  const item = (label: string, run: () => void) => (
    <button
      type="button"
      className="w-full cursor-pointer rounded-sm px-2 py-1 text-left text-sm hover:bg-hover"
      onClick={() => {
        close();
        run();
      }}
    >
      {label}
    </button>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger={
        <button
          type="button"
          className="ml-2 flex max-w-64 cursor-pointer items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-hover"
        >
          <span className="truncate">{name}</span>
          <span
            className={cn(
              "shrink-0 text-2xs",
              status === "failed" ? "text-destructive" : "text-subtle-foreground",
            )}
          >
            {STATUS[status]}
          </span>
        </button>
      }
    >
      <div className="flex w-64 flex-col gap-0.5 p-1">
        <input
          key={name}
          defaultValue={name}
          aria-label="Project name"
          className="mb-1 rounded-sm border border-border bg-surface-sunken px-2 py-1 text-sm outline-none focus:border-ring"
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            void bus.run(renameProject, { name: e.currentTarget.value });
            close();
          }}
        />
        <DescriptionField />
        {item("Save", () => void bus.run(saveProject, {}))}
        {item("Save As…", () => void bus.run(askSaveAs, {}))}
        {item("Open…", () => void bus.run(askOpen, {}))}
        {item("Home", () => void bus.run(showStart, {}))}
      </div>
    </Popover>
  );
}
