import { SealMark } from "@/ui";

/** The seal mark and the app name. */
export function Brand() {
  return (
    <div className="flex items-center gap-2 font-semibold tracking-[-0.01em]" title="Cloudy Clip">
      <SealMark className="size-6" />
      <span>Cloudy Clip</span>
    </div>
  );
}
