import { ErrorBoundary, type LayoutPanel } from "@/core";

/** Renders panels one after another, each behind its own error boundary. */
export function PanelSlot({ panels }: { panels: readonly LayoutPanel[] }) {
  return (
    <>
      {panels.map(({ id, title, component: Panel }) => (
        <ErrorBoundary key={id} name={title}>
          <Panel />
        </ErrorBoundary>
      ))}
    </>
  );
}
