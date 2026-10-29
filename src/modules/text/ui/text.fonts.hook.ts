import { useEffect, useState, useSyncExternalStore } from "react";
import { useModule } from "@/core";
import { fontsRef, type FontFamily, type FontRequest, type FontStatus } from "@/modules/fonts";

/** Every family the picker offers; empty until the first read finishes (offline still resolves). */
export function useFamilies(): FontFamily[] {
  const fonts = useModule(fontsRef);
  const [families, setFamilies] = useState<FontFamily[]>([]);
  useEffect(() => {
    let alive = true;
    void fonts.families().then((list) => alive && setFamilies(list));
    return () => {
      alive = false;
    };
  }, [fonts]);
  return families;
}

/** The state of a face; re-renders when fonts finish loading. `undefined` until it is requested. */
export function useFontStatus(request: FontRequest): FontStatus | undefined {
  const fonts = useModule(fontsRef);
  return useSyncExternalStore(fonts.onLoaded, () => fonts.status(request));
}
