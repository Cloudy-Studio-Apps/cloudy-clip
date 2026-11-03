import { ToolHeader } from "./ToolHeader";
import { ToolRail } from "./ToolRail";
import { TOOLS } from "./tools/tools.registry";
import { useTintView } from "./view.hook";

/** The tools: a rail of icons, a header naming the open tool, and its body. */
export function ToolsPanel() {
  const tool = useTintView((v) => v.tool);
  const entry = TOOLS.find((t) => t.id === tool) ?? TOOLS[0]!;
  const Body = entry.component;
  return (
    <section className="flex min-h-0 min-w-0 overflow-hidden rounded-md bg-surface shadow-[0_0_0_1px_var(--border)]">
      <ToolRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <ToolHeader name={entry.name} />
        <div className="min-h-0 flex-1 overflow-auto px-6 py-3">
          <Body />
        </div>
      </div>
    </section>
  );
}
