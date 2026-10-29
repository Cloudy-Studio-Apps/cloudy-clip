import { z } from "zod";
import { labelOf } from "@/modules/element";
import { Button } from "@/ui";
import type { CommandControlProps } from "../../inspector.types";

/** One button per value of the command's enum field (e.g. presets); a click runs it with that value. */
export function ChoicesControl({ field, run }: CommandControlProps) {
  if (!field || !(field.schema instanceof z.ZodEnum)) return null;
  const values = field.schema.options as readonly string[];
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <Button key={value} size="sm" onClick={() => run({ [field.name]: value })}>
          {labelOf(value)}
        </Button>
      ))}
    </div>
  );
}
