import { PreviewStage } from "./PreviewStage";
import { Transport } from "./Transport";

/** The preview panel: the stage with the frame, and the transport bar under it. */
export function PreviewPanel() {
  return (
    <section className="flex h-full flex-col">
      <PreviewStage />
      <Transport />
    </section>
  );
}
