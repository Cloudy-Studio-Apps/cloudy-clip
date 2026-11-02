import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { useModule, usePoint } from "@/core";
import { cn, Dialog } from "@/ui";
import { settingsSections } from "../settings.points";
import { settingsRef } from "../settings.ref";

/** The Settings window: a list of the sections modules contribute, and the one picked. */
export function SettingsDialog() {
  const settings = useModule(settingsRef);
  const open = useStore(settings.store, (state) => state.open);
  const contributed = usePoint(settingsSections);
  const sections = useMemo(
    () => [...contributed].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [contributed],
  );
  const [picked, setPicked] = useState<string | null>(null);
  const section = sections.find(({ id }) => id === picked) ?? sections[0];

  if (!open || !section) return null;
  return (
    <Dialog title="Settings" size="wide" onClose={settings.close}>
      <div className="flex min-h-0 gap-4">
        {sections.length > 1 && (
          <nav aria-label="Settings sections" className="flex w-36 shrink-0 flex-col gap-0.5">
            {sections.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                aria-current={id === section.id ? "page" : undefined}
                onClick={() => setPicked(id)}
                className={cn(
                  "h-7 cursor-pointer rounded-xs px-2 text-left text-sm hover:bg-hover",
                  id === section.id ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
        <div className="min-w-0 flex-1">
          <section.component />
        </div>
      </div>
    </Dialog>
  );
}
