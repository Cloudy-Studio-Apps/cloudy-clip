import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { HistorySnapshot } from "../history/history.types";
import type { Kernel } from "../kernel";
import type { ModuleRef } from "../module/module.types";
import type { Point } from "../module/points.types";

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

/** Returns a loaded module's API (its stores and services) for the current kernel. */
export function useModule<A>(ref: ModuleRef<A>): A {
  return useKernel().modules.require(ref);
}

/** Items contributed to a point. Re-renders when the point changes. */
export function usePoint<T>(point: Point<T>): readonly T[] {
  const { points } = useKernel();
  return useSyncExternalStore(points.subscribe, () => points.get(point));
}
