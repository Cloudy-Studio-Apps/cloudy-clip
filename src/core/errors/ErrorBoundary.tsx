import { Component, type ErrorInfo, type ReactNode } from "react";
import { createLogger } from "./logger";

const log = createLogger("ui");

interface ErrorBoundaryProps {
  /** Shown in the fallback so the user knows which panel failed. */
  name: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Isolates a panel: if anything inside it throws while rendering, only that panel shows a
 * fallback and the rest of the editor keeps working. The user can retry without restarting.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    log.error(`Panel "${this.props.name}" crashed`, { error, componentStack: info.componentStack });
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-sm text-neutral-400">
        <p>
          The <span className="font-medium text-neutral-200">{this.props.name}</span> panel ran into
          a problem.
        </p>
        <p className="max-w-md truncate text-xs text-neutral-500">{this.state.error.message}</p>
        <button
          type="button"
          className="rounded bg-neutral-800 px-3 py-1 text-neutral-200 hover:bg-neutral-700"
          onClick={() => this.setState({ error: null })}
        >
          Retry
        </button>
      </div>
    );
  }
}
