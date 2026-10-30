import { useOpenComposition } from "@/modules/project";
import { EmptyState } from "@/ui";
import { PreviewStage } from "./PreviewStage";
import { Transport } from "./Transport";

/** The preview panel: the stage with the frame, and the transport bar under it. */
export function PreviewPanel() {
  const open = useOpenComposition();
  return (
    <section className="relative flex h-full flex-col">
      <PreviewStage />
      {!open && (
        <EmptyState title="Nothing open" className="absolute inset-3 bottom-14 bg-stage">
          Your composition shows here.
        </EmptyState>
      )}
      <Transport />
    </section>
  );
}
