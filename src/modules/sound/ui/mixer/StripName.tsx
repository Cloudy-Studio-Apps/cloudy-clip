import { useRef, useState } from "react";
import { useKernel } from "@/core";
import type { CompositionId, MixBus } from "@/modules/project";
import { setBus } from "../../sound.bus.commands";
import { report } from "../report";

const NAME = "truncate text-center font-hand text-base font-bold leading-tight";

interface StripNameProps {
  name: string;
  /** A group's strip: a double-click renames it (one `sound.setBus`). */
  group?: { bus: MixBus; compositionId: CompositionId };
}

/** The name at the top of a strip; a group's is renamed in place with a double-click. */
export function StripName({ name, group }: StripNameProps) {
  const { bus } = useKernel();
  const [editing, setEditing] = useState(false);
  // Escape leaves without renaming, even if the input blurs as it goes.
  const cancelled = useRef(false);
  if (!group) return <div className={NAME}>{name}</div>;
  if (!editing) {
    return (
      <div
        className={NAME}
        title="Double-click to rename"
        onDoubleClick={() => {
          cancelled.current = false;
          setEditing(true);
        }}
      >
        {name}
      </div>
    );
  }
  const commit = (value: string) => {
    setEditing(false);
    const next = value.trim();
    if (cancelled.current || !next || next === name) return;
    void bus
      .run(setBus, {
        compositionId: group.compositionId,
        busId: group.bus.id,
        patch: { name: next },
      })
      .then(report);
  };
  return (
    <input
      autoFocus
      aria-label="Group name"
      defaultValue={name}
      maxLength={64}
      className="w-full rounded-xs border border-border-strong bg-surface px-1 text-center font-hand text-base font-bold leading-tight outline-none focus:border-foreground"
      onClick={(event) => event.stopPropagation()}
      onFocus={(event) => event.currentTarget.select()}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key !== "Escape") return;
        cancelled.current = true;
        setEditing(false);
      }}
    />
  );
}
