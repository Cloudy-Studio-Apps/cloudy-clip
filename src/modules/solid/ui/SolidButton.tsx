import { Square } from "lucide-react";
import { useState } from "react";
import { Button } from "@/ui";
import { SolidDialog } from "./SolidDialog";

/** Opens the dialog that adds a solid color to the library. */
export function SolidButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" title="New solid color" onClick={() => setOpen(true)}>
        <Square />
        Solid color
      </Button>
      {open && <SolidDialog onClose={() => setOpen(false)} />}
    </>
  );
}
