/**
 * Public API of the kernel. Modules (and, later, plugins) import from `@/core` only.
 * @module core
 */

// Kernel
export { createKernel, type Kernel } from "./kernel";

// Commands
export { defineCommand } from "./command/define-command";
export type {
  CommandBus,
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
export { createPatchableStore } from "./store/patchable-store";
export type { PatchableStore } from "./store/store.types";

// Modules
export { defineModule, defineModuleRef } from "./module/define-module";
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
} from "./shell/shell.types";

// MCP
export { commandTool, defineMcpTool, errorResult, textResult } from "./mcp/define-mcp-tool";
export { createMcpBridge, type McpBridge } from "./mcp/mcp-bridge";
export { createTauriMcpTransport } from "./mcp/tauri-transport";
export type {
  McpCall,
  McpContent,
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
export { createLogger, type Logger } from "./errors/logger";
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
export { KernelProvider, useHistory, useKernel, useModule, usePoint } from "./react/kernel-context";
