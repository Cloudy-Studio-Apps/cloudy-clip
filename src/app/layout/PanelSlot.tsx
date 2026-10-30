import { ErrorBoundary, type LayoutPanel } from "@/core";

/** Renders panels one after another, each behind its own error boundary. */
export function PanelSlot({ panels }: { panels: readonly LayoutPanel[] }) {
  return (
    <>
      {panels.map(({ id, title, component: Panel }) => (
        <div key={id} className="contents" data-collab-target={`panel:${id}`}>
          <ErrorBoundary name={title}>
            <Panel />
          </ErrorBoundary>
        </div>
      ))}
    </>
  );
}
