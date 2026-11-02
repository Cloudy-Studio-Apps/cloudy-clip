import { SealSketch } from "@/ui";

/** The Sound page. Nothing lives here yet, so the seal draws itself each time you open it. */
export function SoundPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-surface px-6 text-center">
      <SealSketch className="mb-2 aspect-[6/5] h-[min(250px,45vh)]" />
      <h1 className="font-hand text-[30px] font-extrabold leading-none">Sound isn't inked yet</h1>
      <p className="max-w-[40ch] text-md text-muted-foreground">
        Sound clips are on the timeline, on the Edit page.
      </p>
    </div>
  );
}
