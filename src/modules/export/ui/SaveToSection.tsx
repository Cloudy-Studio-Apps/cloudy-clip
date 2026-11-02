import { useModule } from "@/core";
import { Button } from "@/ui";
import { exportRef } from "../export.ref";
import { pickFolder } from "../export.service";
import { ExportRow } from "./ExportRow";

const FIELD =
  "h-[26px] min-w-0 border-b border-border-strong bg-transparent px-1 text-foreground outline-none focus:border-ring";

/** The file's name and folder, first on the page. */
export function SaveToSection({ name, folder }: { name: string; folder: string }) {
  const { form } = useModule(exportRef);
  const browse = async () => {
    const chosen = await pickFolder(folder);
    if (chosen) form.setState({ folder: chosen });
  };
  return (
    <>
      <ExportRow label="Name">
        <input
          aria-label="File name"
          value={name}
          spellCheck={false}
          onChange={(event) => form.setState({ name: event.target.value })}
          className={`${FIELD} text-[13px]`}
        />
      </ExportRow>
      <div className="flex items-center gap-2">
        <input
          aria-label="Folder"
          value={folder}
          spellCheck={false}
          onChange={(event) => form.setState({ folder: event.target.value })}
          className={`${FIELD} flex-1 font-mono text-[12.5px]`}
        />
        <Button size="sm" onClick={() => void browse()}>
          Browse
        </Button>
      </div>
    </>
  );
}
