import { createElement } from "react";
import { controlIcon } from "./controls.icons";

/** The icon a control names (`icon: "Italic"`), or nothing when the name is unknown. */
export function ControlIcon({ name }: { name: string | undefined }) {
  const icon = controlIcon(name);
  return icon ? createElement(icon) : null;
}
