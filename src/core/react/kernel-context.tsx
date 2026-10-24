import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { HistorySnapshot } from "../history/history.types";
import type { Kernel } from "../kernel";

const KernelContext = createContext<Kernel | null>(null);

/** Makes the kernel available to React components. */
export function KernelProvider({ kernel, children }: { kernel: Kernel; children: ReactNode }) {
  return <KernelContext.Provider value={kernel}>{children}</KernelContext.Provider>;
}

/** Returns the kernel. Must be used under {@link KernelProvider}. */
export function useKernel(): Kernel {
  const kernel = useContext(KernelContext);
  if (!kernel) throw new Error("useKernel must be used inside <KernelProvider>");
  return kernel;
}

/** Subscribes to the undo history. Re-renders only when it changes. */
export function useHistory(): HistorySnapshot {
  const { history } = useKernel();
  return useSyncExternalStore(history.subscribe, history.getSnapshot);
}
