/** Thrown by a runner without WebGL2: none at all, or a lost context that couldn't be made again. */
export class GpuUnavailable extends Error {
  constructor(message = "WebGL2 is not available") {
    super(message);
    this.name = "GpuUnavailable";
  }
}
