import { useModule } from "@/core";
import { Button } from "@/ui";
import { exportRef } from "../export.ref";
import { pickFolder } from "../export.service";
import { ExportHeading } from "./ExportHeading";
import { ExportRow } from "./ExportRow";

const FIELD =
  "h-7 min-w-0 rounded-sm border border-border bg-surface-sunken px-2 text-xs text-foreground outline-none focus:border-ring";

/** The file's name and folder, first on the page. */
export function SaveToSection({ name, folder }: { name: string; folder: string }) {
  const { form } = useModule(exportRef);
  const browse = async () => {
    const chosen = await pickFolder(folder);
    if (chosen) form.setState({ folder: chosen });
  };
  return (
    <section className="flex flex-col gap-2">
      <ExportHeading>Save to</ExportHeading>
      <ExportRow label="Name">
        <input
          aria-label="File name"
          value={name}
          spellCheck={false}
          onChange={(event) => form.setState({ name: event.target.value })}
          className={FIELD}
        />
      </ExportRow>
      <div className="flex gap-1.5">
        <input
          aria-label="Folder"
          value={folder}
          spellCheck={false}
          onChange={(event) => form.setState({ folder: event.target.value })}
          className={`${FIELD} flex-1`}
        />
        <Button size="sm" onClick={() => void browse()}>
          Browse
        </Button>
      </div>
    </section>
  );
}
