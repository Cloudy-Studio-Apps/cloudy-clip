import { Italic } from "lucide-react";
import type { FieldControlProps } from "@/modules/inspector";
import { IconButton } from "@/ui";
import { hasItalic } from "../../logic/fontpick";
import { useClipFamily } from "./controls.family.hook";

/** The `font-italic` control: an icon toggle, off and disabled when the family has no italic. */
export function FontItalicControl({ value, values, label, live }: FieldControlProps) {
  const family = useClipFamily(values);
  const available = !family || hasItalic(family);
  return (
    <IconButton
      label={available ? label : `${label} (this font has none)`}
      active={value === true}
      disabled={!available}
      onClick={() => live.commit({ italic: value !== true })}
    >
      <Italic />
    </IconButton>
  );
}
