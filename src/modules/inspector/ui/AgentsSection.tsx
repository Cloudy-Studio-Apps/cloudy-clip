import { InspectorSection } from "./InspectorSection";

/** The command that connects Claude Code to the built-in MCP server. */
const CONNECT_COMMAND = "claude mcp add --transport http cloudy-clip http://127.0.0.1:7420/mcp";

/** How an agent can edit this project alongside the user. */
export function AgentsSection() {
  return (
    <InspectorSection title="Agents">
      <p className="m-0 text-sm text-muted-foreground">
        Agents like Claude can edit this project with you, live. Anything they change can be undone.
      </p>
      <div className="flex items-center border border-border bg-surface-sunken px-2 py-1.5">
        <code
          className="min-w-0 flex-1 select-text truncate font-mono text-2xs text-muted-foreground"
          title={CONNECT_COMMAND}
        >
          {CONNECT_COMMAND}
        </code>
      </div>
    </InspectorSection>
  );
}
