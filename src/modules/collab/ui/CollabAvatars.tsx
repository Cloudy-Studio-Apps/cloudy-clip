import { useMemo } from "react";
import { useStore } from "zustand";
import { useModule } from "@/core";
import { Popover } from "@/ui";
import { collabRef } from "../collab.ref";
import { CollabAvatar } from "./CollabAvatar";
import { CollabPanel } from "./CollabPanel";

/** Everyone in the project, like a shared doc. Opens the panel about them. */
export function CollabAvatars() {
  const { store } = useModule(collabRef);
  const collaborators = useStore(store, (state) => state.collaborators);
  const blocked = useStore(store, (state) => state.blocked);
  // Agents first, then the user, as in the prototype.
  const people = useMemo(
    () =>
      Object.values(collaborators).sort(
        (a, b) => Number(a.kind === "local") - Number(b.kind === "local"),
      ),
    [collaborators],
  );

  return (
    <Popover
      trigger={
        <button
          type="button"
          aria-label="Collaborators"
          className="flex cursor-pointer items-center [&>*+*]:-ml-1.5"
        >
          {people.map((who) => (
            <CollabAvatar key={who.id} who={who} off={blocked.includes(who.id)} />
          ))}
        </button>
      }
    >
      <CollabPanel people={people} blocked={blocked} />
    </Popover>
  );
}
