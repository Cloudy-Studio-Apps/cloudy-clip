import { useState } from "react";
import { useKernel, useModule } from "@/core";
import { COMPOSITION_PRESETS, compositionRef, createComposition } from "@/modules/composition";
import type { ProjectFormat } from "@/modules/project";
import { Button, cn } from "@/ui";
import { DEFAULT_NAME } from "../logic/names";
import { newProject } from "../workspace.commands";
import { workspaceRef } from "../workspace.ref";

const SHAPE_SIZE = 14;
const FIELD =
  "rounded-sm border border-border bg-surface-sunken px-2 py-1 text-sm outline-none focus:border-ring";

/** A little outline in the format's shape. */
function FormatShape({ format }: { format: ProjectFormat }) {
  const scale = SHAPE_SIZE / Math.max(format.width, format.height);
  return (
    <span className="grid size-4 place-items-center">
      <span
        className="rounded-xs border border-muted-foreground"
        style={{ width: format.width * scale, height: format.height * scale }}
      />
    </span>
  );
}

/** Starts a project from what it's for: each purpose is a recommended size. */
export function NewProjectColumn() {
  const { bus } = useKernel();
  const composition = useModule(compositionRef);
  const workspace = useModule(workspaceRef);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  async function start(format?: ProjectFormat) {
    await workspace.prepareLeave();
    const result = await bus.run(newProject, { name, description });
    if (!result.ok) return;
    if (!format) composition.openNew();
    else await bus.run(createComposition, { name: "Main", format, extendToFit: true });
  }

  return (
    <section className="flex flex-col gap-1">
      <h3 className="mb-1 text-sm font-semibold">New project</h3>
      <input
        value={name}
        placeholder={DEFAULT_NAME}
        aria-label="Project name"
        className={FIELD}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        value={description}
        rows={2}
        maxLength={2000}
        placeholder="What's it about? (optional)"
        aria-label="Description"
        className={cn(FIELD, "resize-none")}
        onChange={(e) => setDescription(e.target.value)}
      />
      <p className="my-1 text-xs text-muted-foreground">What is it for?</p>
      {COMPOSITION_PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-hover"
          onClick={() => void start(preset.format)}
        >
          <FormatShape format={preset.format} />
          <span className="min-w-0 flex-1 truncate">{preset.hint}</span>
          <span className="font-mono text-2xs text-subtle-foreground">{preset.label}</span>
        </button>
      ))}
      <Button size="sm" className="mt-auto" onClick={() => void start()}>
        Custom size…
      </Button>
    </section>
  );
}
