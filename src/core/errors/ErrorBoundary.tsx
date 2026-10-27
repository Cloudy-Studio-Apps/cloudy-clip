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
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4 text-base text-muted-foreground">
        <p>
          The <span className="font-medium text-foreground">{this.props.name}</span> panel ran into
          a problem.
        </p>
        <p className="max-w-md truncate text-sm text-subtle-foreground">
          {this.state.error.message}
        </p>
        <button
          type="button"
          className="h-7 cursor-pointer rounded-sm border border-border bg-surface-sunken px-2.5 text-sm font-medium text-foreground hover:border-border-strong hover:bg-hover"
          onClick={() => this.setState({ error: null })}
        >
          Retry
        </button>
      </div>
    );
  }
}
