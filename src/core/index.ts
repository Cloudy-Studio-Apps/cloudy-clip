/**
 * Public API of the kernel. Modules (and, later, plugins) import from `@/core` only.
 * @module core
 */

// Kernel
export { createKernel } from "./kernel";
export type { Kernel } from "./kernel.types";

// Commands
export { LOCAL_ACTOR } from "./command/command.actor";
export { defineCommand } from "./command/command.define";
export type {
  ActorId,
  CommandBus,
  CommandInputs,
  PanelCommandId,
  CommandContext,
  CommandDefinition,
  CommandExecutedEvent,
  CommandOrigin,
  ExecuteOptions,
} from "./command/command.types";

// History
export { historyRef } from "./history/history.module";
export type { History, HistoryEntry, HistorySnapshot } from "./history/history.types";

// Document stores
export { createPatchableStore } from "./store/store.patchable";
export type { FieldChange, StorePolicy, PatchableStore } from "./store/store.types";

// Modules
export { defineModule, defineModuleRef } from "./module/module.define";
export type {
  AnyModuleDefinition,
  Disposer,
  ModuleContext,
  ModuleDefinition,
  ModuleRef,
  ModuleRegistry,
  ModuleSetup,
  ModuleStatus,
  ModuleTier,
} from "./module/module.types";
export { createPointRegistry, definePoint } from "./module/points";
export type { Point, PointOptions, PointReader, PointRegistry } from "./module/points.types";

// Shell points (panels, keybindings)
export { keybindings, layoutPanels, matchKeybinding } from "./shell/shell.points";
export type {
  Keybinding,
  KeybindingAction,
  KeyPress,
  LayoutPanel,
  LayoutSlot,
  PanelIcon,
} from "./shell/shell.types";

// MCP
export { commandTool, defineMcpTool, errorResult, textResult } from "./mcp/mcp.tool";
export { createMcpBridge } from "./mcp/mcp.bridge";
export { createTauriMcpTransport } from "./mcp/mcp.transport.tauri";
export type {
  McpBridge,
  McpCall,
  McpCallVerdict,
  McpCaller,
  McpContent,
  McpObserver,
  McpRegistry,
  McpToolContext,
  McpToolDefinition,
  McpToolManifest,
  McpToolResult,
  McpTransport,
} from "./mcp/mcp.types";

// Errors
export { CommandFailure, err, ok, toAppError } from "./errors/result";
export type { AppError, Result } from "./errors/result.types";
export { createLogger } from "./errors/logger";
export type { Logger } from "./errors/logger.types";
export { ErrorBoundary } from "./errors/ErrorBoundary";

// Ids
export { createId } from "./ids/ids";

// Time
export { MICROS_PER_SECOND, formatTimecode, microsToSeconds, secondsToMicros } from "./time/time";
export type { Micros } from "./time/time.types";

// Notifications
export { dismiss, notificationsStore, notify } from "./notifications/notifications";
export type { Notification, NotificationLevel } from "./notifications/notifications.types";

// React
export { KernelProvider, useHistory, useKernel, useModule, usePoint } from "./react/react.context";
