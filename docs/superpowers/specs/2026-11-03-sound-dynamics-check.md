# The compressor against FFmpeg: what the check found

Checked on 3 Nov 2026 against the system `ffmpeg` n9.0.2, in a scratch folder. The port is
`compressorStep` in `src/modules/preview/logic/dynamics.ts`, a port of `acompressor`
(`libavfilter/af_sidechaincompress.c`) in downward mode with peak detection, `level_in`, `level_sc` and `mix`
at 1. The FFmpeg source wasn't on the machine: the port was written from the filter's algorithm as published
(one-pole detector with coefficients `min(1, 1 / (ms × rate / 4000))`, gain computed on natural logs, a cubic
Hermite soft knee from `threshold / √knee` to `threshold × √knee`, makeup after the gain) and then checked
sample for sample against the binary. The first version started the knee curve at the compressed knee start
instead of the knee start; steady level and attack matched but release was 72 ms against FFmpeg's 87. Fixed,
every case below matched.

**Method.** A 1 kHz sine at 48 kHz, −30 dBFS for 1 s, −6 dBFS for 1 s, then −30 dBFS again, made by FFmpeg:

```sh
ffmpeg -f lavfi -i "aevalsrc=if(between(t\,1\,2)\,0.5011872336\,0.0316227766)*sin(2*PI*1000*t):s=48000:d=4" \
  -af "acompressor=threshold=<T>dB:ratio=<R>:attack=<A>:release=<Rel>:knee=<K>:makeup=<M>:detection=peak" \
  -c:a pcm_f32le out.wav
```

The same samples went through `compressorStep`. Gain reduction is the input peak over the output peak in each
1 ms (one period) window. Steady is the reduction just before the step down. Attack is the time from the step
up until the reduction reaches 90 % of steady; release is the time from the step down until it falls to 10 %.
Both outputs were also compared sample by sample. The brief's own case, the last second of a 2 s sine at
−6 dBFS through `acompressor=threshold=-18dB:ratio=4:detection=peak,atrim=start=1,astats`, reads −17.254 dB
RMS in FFmpeg and −17.254 dB in the port.

| Threshold, ratio | Attack / release / knee / makeup | Steady reduction FFmpeg / port | Attack FFmpeg / port | Release FFmpeg / port | Largest sample difference |
| ---------------- | -------------------------------- | ------------------------------ | -------------------- | --------------------- | ------------------------- |
| −18 dB, 4        | 20 ms / 250 ms / 9 dB / 0 dB     | 8.245 / 8.245 dB               | 19.77 / 19.77 ms     | 86.77 / 86.77 ms      | 3.0e-8                    |
| −24 dB, 2        | 20 ms / 250 ms / 9 dB / 0 dB     | 8.497 / 8.497 dB               | 15.27 / 15.27 ms     | 132.27 / 132.27 ms    | 3.0e-8                    |
| −12 dB, 8        | 20 ms / 250 ms / 9 dB / 0 dB     | 4.369 / 4.369 dB               | 29.27 / 29.27 ms     | 49.27 / 49.27 ms      | 6.0e-8                    |
| −30 dB, 20       | 5 ms / 50 ms / 0 dB / 6 dB       | 15.713 / 15.713 dB             | 3.29 / 3.29 ms       | 23.75 / 23.75 ms      | 3.0e-8                    |
| −20 dB, 3        | 100 ms / 1000 ms / 18 dB / 3 dB  | 5.560 / 5.560 dB               | 111.27 / 111.27 ms   | 247.77 / 247.77 ms    | 6.0e-8                    |

The first three rows are the three threshold and ratio pairs; the last two move attack, release, knee and
makeup (with makeup, the reduction shown is net of it). A 9 dB knee is FFmpeg's default 2.82843. The largest
differences are a float's last bit: FFmpeg writes 32-bit floats, the port computes in doubles.

**Verdict.** The bar is steady-state gain reduction within 0.5 dB and attack and release within 10 %. Every
case is within 0.000001 dB and identical to the 1/48 ms the timing reads. The compressor ships, and its formula
is the dynamics core for the gate, limiter, ducking and de-esser.

**For export.** FFmpeg's default detection is RMS, not peak. The brief's command without `detection=peak`
reads −17.42 dB instead of −17.25 dB, so export must always write `detection=peak`. The port takes one
mono sample. For stereo, FFmpeg feeds the detector the average of the channels (`link`, or their maximum) and
applies one gain to every channel, so the worklet will need the detector and the gain apart.

Not run: RMS detection, upward mode, `mix` and `level_in` other than 1, the sidechain input (ducking), sample
rates other than 48 kHz, and the worklet itself in WebKitGTK.
