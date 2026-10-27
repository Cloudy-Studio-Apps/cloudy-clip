import { useEffect } from "react";
import { KernelProvider, type Kernel } from "@/core";
import { installKeybindings } from "./app.keybindings";
import { LayoutHost } from "./layout/LayoutHost";
import { Notifications } from "./Notifications";

/** The editor: panels and keybindings come from what modules contribute to the shell points. */
export function App({ kernel }: { kernel: Kernel }) {
  useEffect(() => installKeybindings(kernel), [kernel]);

  return (
    <KernelProvider kernel={kernel}>
      <LayoutHost />
      <Notifications />
    </KernelProvider>
  );
}
