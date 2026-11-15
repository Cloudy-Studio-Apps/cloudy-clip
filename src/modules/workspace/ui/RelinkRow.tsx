import { Button } from "@/ui";

interface RelinkRowProps {
  /** What the file is called in the project. */
  name: string;
  /** Where the project last had it (the row's tooltip). */
  path: string;
  /** Said after the name, muted (`LUT`). */
  tag?: string;
  onLocate(): void;
}

/** One missing file in the relink dialog: its name and a Locate… button. */
export function RelinkRow({ name, path, tag, onLocate }: RelinkRowProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-0 flex-1 truncate text-sm" title={path}>
        {name} {tag && <span className="text-muted-foreground">({tag})</span>}
      </span>
      <Button size="sm" onClick={onLocate}>
        Locate…
      </Button>
    </div>
  );
}
