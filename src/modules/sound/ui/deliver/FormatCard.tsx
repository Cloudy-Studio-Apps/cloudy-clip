import { PanelCard, PanelValue } from "../card";

/**
 * "Audio format": the codec and sample rate of the exported sound, `—` until stage 4 offers them
 * (`deliver.format`), and the channels, Stereo, which is true: the mix is stereo only.
 */
export function FormatCard() {
  return (
    <PanelCard title="Audio format" className="row-span-2">
      <PanelValue label="Codec" pick soon="deliver.format" />
      <PanelValue label="Sample rate" pick soon="deliver.format" />
      <PanelValue label="Channels" value="Stereo" />
    </PanelCard>
  );
}
