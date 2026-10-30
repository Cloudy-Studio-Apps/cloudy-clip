import { useStore } from "zustand";
import { useKernel, useModule } from "@/core";
import { projectRef } from "@/modules/project";
import { setDescription } from "../workspace.commands";

/** What the project is about. One command once typing ends, so it's one undo step. */
export function DescriptionField() {
  const { bus } = useKernel();
  const { store } = useModule(projectRef);
  const description = useStore(store.api, (s) => s.description ?? "");

  const commit = (text: string) => {
    if (text.trim() !== description) void bus.run(setDescription, { description: text });
  };

  return (
    <textarea
      key={description}
      defaultValue={description}
      rows={3}
      maxLength={2000}
      placeholder="What's it about? (optional)"
      aria-label="Description"
      className="mb-1 resize-none rounded-sm border border-border bg-surface-sunken px-2 py-1 text-sm outline-none focus:border-ring"
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key !== "Enter" || e.shiftKey) return;
        e.preventDefault();
        commit(e.currentTarget.value);
      }}
    />
  );
}
