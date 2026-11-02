import { BinTree } from "./BinTree";
import { DiskList } from "./DiskList";
import { SmartBinList } from "./SmartBinList";

/** The Media page's left column: where files come from and where they're kept. */
export function LibrarySidebar() {
  return (
    <aside className="flex min-h-0 flex-col border-r border-border-strong bg-muted">
      <DiskList />
      <BinTree />
      <SmartBinList />
    </aside>
  );
}
