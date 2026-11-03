import type { ComponentType } from "react";
import type { ToolId } from "../../tint.types";

/** A tool in the rail: its icon, name, what it's for, its key, and the body it shows. */
export interface ToolEntry {
  id: ToolId;
  name: string;
  tip: string;
  key?: string;
  icon: ComponentType<{ className?: string }>;
  component: ComponentType;
}
