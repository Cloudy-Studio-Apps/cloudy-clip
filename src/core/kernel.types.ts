import type { CommandBus } from "./command/command.types";
import type { History } from "./history/history.types";
import type { McpRegistry } from "./mcp/mcp.types";
import type { ModuleRegistry } from "./module/module.types";
import type { PointReader } from "./module/points.types";

/** The application kernel: everything modules and plugins plug into. */
export interface Kernel {
  readonly bus: CommandBus;
  readonly history: History;
  readonly mcp: McpRegistry;
  readonly modules: ModuleRegistry;
  /** Every contribution made by loaded modules (panels, keybindings, ...). */
  readonly points: PointReader;
}
