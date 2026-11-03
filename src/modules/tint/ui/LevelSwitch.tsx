import { Folder, Rows3, Square } from "lucide-react";
import type { ComponentType } from "react";
import { IconButton } from "@/ui";
import type { GradeLevel } from "../tint.types";
import { useTintView } from "./view.hook";
import { useTintSet } from "./view.set.hook";

const LEVELS: readonly { level: GradeLevel; icon: ComponentType; label: string }[] = [
  { level: "clip", icon: Square, label: "This clip: the grade applies to this clip only" },
  {
    level: "group",
    icon: Folder,
    label: "Shot group: one grade shared by every Plaza shot, after each clip's own",
  },
  {
    level: "timeline",
    icon: Rows3,
    label: "Whole timeline: a grade over the finished edit, after every clip",
  },
];

/** Which grade the page edits: this clip's, its shot group's, or the whole timeline's. */
export function LevelSwitch() {
  const level = useTintView((v) => v.level);
  const set = useTintSet();
  return (
    <span
      role="radiogroup"
      aria-label="Which grade"
      className="flex rounded-sm bg-background p-0.5"
    >
      {LEVELS.map((item) => {
        const Icon = item.icon;
        return (
          <IconButton
            key={item.level}
            label={item.label}
            active={level === item.level}
            onClick={() => set({ level: item.level })}
            className="size-6"
          >
            <Icon />
          </IconButton>
        );
      })}
    </span>
  );
}
