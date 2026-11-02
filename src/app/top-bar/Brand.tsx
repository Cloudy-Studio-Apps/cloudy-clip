import { SealMark } from "@/ui";

/** The foca watona and the app's wordmark. */
export function Brand() {
  return (
    <div className="flex shrink-0 items-center gap-2" title="Cloudy Clip">
      <SealMark className="h-[30px] w-9" />
      <span className="font-hand text-display font-extrabold leading-none tracking-[-0.01em]">
        cloudy clip
      </span>
    </div>
  );
}
