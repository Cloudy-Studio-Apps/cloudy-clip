import type { ReactNode } from "react";
import { SealSketch } from "../brand/SealSketch";

interface SketchPageProps {
  title: string;
  children: ReactNode;
}

/** A page with nothing on it yet: the seal draws itself over a title and one line. */
export function SketchPage({ title, children }: SketchPageProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1.5 bg-surface px-6 text-center">
      <SealSketch className="mb-2 aspect-[6/5] h-[min(250px,45vh)]" />
      <h1 className="font-hand text-[30px] font-extrabold leading-none">{title}</h1>
      <p className="max-w-[40ch] text-md text-muted-foreground">{children}</p>
    </div>
  );
}
