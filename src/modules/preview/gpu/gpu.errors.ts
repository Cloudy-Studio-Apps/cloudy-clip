/**
 * Thrown by a runner without WebGL2: none at all, or a lost context that couldn't be made again.
 * A transition's mix in a capture or an export also turns any GPU error into one (with its `cause`).
 */
export class GpuUnavailable extends Error {
  constructor(message = "WebGL2 is not available", options?: ErrorOptions) {
    super(message, options);
    this.name = "GpuUnavailable";
  }
}
