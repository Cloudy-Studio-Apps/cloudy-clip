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

## The gate, the de-esser, the limiter and ducking

Checked on 3 Nov 2026 against the same `ffmpeg` n9.0.2, this time with the filters' source at the tag
(`libavfilter/af_agate.c`, `af_deesser.c`, `af_alimiter.c`, `af_sidechaincompress.c` from
`github.com/FFmpeg/FFmpeg/tree/n9.0.2`). The compressor's formula became one core
(`src/modules/preview/logic/dynamics.ts`): a `DynamicsCurve` worked out once from the settings and
`dynamicsGain`, which moves the detector by one level and gives the factor for the whole frame. FFmpeg's
`link=average` feeds the detector the mean of the channels' magnitudes and applies one gain to all of them,
and the port does the same (`linkedLevel`). The gate is the same detector with `agate`'s downward-expansion
curve; ducking is the compressor curve listening to a key. The de-esser and the limiter are not detector and
curve designs in FFmpeg (the de-esser is Airwindows' DeEss, per channel; the limiter schedules gain ramps
through a lookahead buffer), so they are ports of their own algorithms in `logic/deesser.ts` and
`logic/limiter.ts`. All are pure and allocate nothing per sample.

**Method.** As above: FFmpeg made each signal with `aevalsrc` at 48 kHz, wrote its output with
`-f f32le -ac 1` (interleaved stereo for the stereo runs), the same samples went through the port, and both
were measured the same way (reduction per 1 ms window, steady just before the step, 90 % and 10 % times),
and compared sample by sample.

```sh
# gate: 1 kHz at −20 dBFS, −38 dBFS from 1 s to 2 s
ffmpeg -f lavfi -i "aevalsrc=if(between(t\,1\,2)\,0.0125892541\,0.1)*sin(2*PI*1000*t):s=48000:d=3" \
  -af "agate=threshold=<T>dB:ratio=<R>:attack=<A>:release=<Rel>:detection=peak" -f f32le -ac 1 gate.f32
# de-esser: 6.5 kHz at −30 dBFS, −6 dBFS from 1 s to 2 s
ffmpeg -f lavfi -i "aevalsrc=if(between(t\,1\,2)\,0.5011872336\,0.0316227766)*sin(2*PI*6500*t):s=48000:d=3" \
  -af "deesser=i=<amount>:m=0.5:f=<deesserFrequency(Hz)>" -f f32le -ac 1 ds.f32
# limiter: 1 kHz at −12 dBFS, +6 dBFS from 1 s to 2 s
ffmpeg -f lavfi -i "aevalsrc=if(between(t\,1\,2)\,2\,0.2511886432)*sin(2*PI*1000*t):s=48000:d=3" \
  -af "alimiter=limit=<C>dB:attack=5:release=<Rel>:level=disabled" -f f32le -ac 1 lim.f32
```

| Gate: threshold, ratio, attack / release | Steady reduction FFmpeg / port | Close (90 %) FFmpeg / port | Open (10 %) FFmpeg / port | Largest sample difference |
| ---------------------------------------- | ------------------------------ | -------------------------- | ------------------------- | ------------------------- |
| −30 dB, 2, 20 / 250 ms                   | 9.007 / 9.007 dB               | 181.27 / 181.27 ms         | 1.75 / 1.75 ms            | 7.5e-9                    |
| −26 dB, 4, 5 / 100 ms (at the range)     | 24.258 / 24.258 dB             | 44.79 / 44.79 ms           | 0.75 / 0.75 ms            | 7.5e-9                    |
| −40 dB, 1.5, 50 / 500 ms (in the knee)   | 0.374 / 0.374 dB               | 423.77 / 423.77 ms         | 0.27 / 0.27 ms            | 7.5e-9                    |

| De-esser: frequency, amount | `f`      | Steady reduction FFmpeg / port | In (90 %) FFmpeg / port | Out (10 %) FFmpeg / port | Largest sample difference |
| --------------------------- | -------- | ------------------------------ | ----------------------- | ------------------------ | ------------------------- |
| 6500 Hz, 0.5                | 0.918208 | 6.765 / 6.765 dB               | 0.06 / 0.06 ms          | 0 / 0 ms                 | 8.9e-8                    |
| 4000 Hz, 1                  | 0.824693 | 8.674 / 8.674 dB               | 0.08 / 0.08 ms          | 0 / 0 ms                 | 1.9e-7                    |
| 8000 Hz, 0.3                | 0.947458 | 3.199 / 3.199 dB               | 1.60 / 1.60 ms          | 7.29 / 7.29 ms           | 8.9e-8                    |

| Limiter: ceiling, release | Largest output FFmpeg / port | Steady reduction FFmpeg / port | Release (10 %) FFmpeg / port | Largest sample difference |
| ------------------------- | ---------------------------- | ------------------------------ | ---------------------------- | ------------------------- |
| −1 dB, 50 ms              | −1.000 / −1.000 dBFS         | 7.021 / 7.021 dB               | 41.77 / 41.77 ms             | 6.0e-8                    |
| −6 dB, 200 ms             | −6.000 / −6.000 dBFS         | 12.021 / 12.021 dB             | 164.77 / 164.77 ms           | 3.0e-8                    |
| −0.1 dB, 1000 ms          | −0.100 / −0.100 dBFS         | 6.121 / 6.121 dB               | 864.27 / 864.27 ms           | 6.0e-8                    |

The limiter's output is its input 239 samples later at 48 kHz (`attack=5`, `latency` off); the reduction is
measured against the delayed input, and the first second matches it exactly. At 44.1 kHz the de-esser (6500 Hz,
0.5) differs by at most 8.9e-8 and the limiter (−20 dB, 50 ms) by 0. In stereo (1 kHz at −12 dBFS on the left,
700 Hz at −10.5 dBFS dropping to −40 dBFS on the right), run through the worklet's block code
(`createEffectRunner`, 128-sample blocks): the gate (−30 dB, 3, 10 / 200 ms) differs by 1.5e-8, the limiter
(−12 dB, 80 ms) by 0 when FFmpeg reads the same 32-bit input (9.2e-6 when FFmpeg makes the signal itself in
doubles), and ducking by 6.0e-8 against

```sh
ffmpeg -f lavfi -i "<the stereo signal>" -f lavfi -i "aevalsrc=if(between(t\,1\,2)\,0.1\,0)*sin(2*PI*300*t)|<same>:s=48000:d=3" \
  -filter_complex "[0][1]sidechaincompress=threshold=-40dB:ratio=20:attack=20:release=300:detection=peak:mix=0.645186611" -f f32le duck.f32
```

**Verdict.** Every case of every kind is identical to FFmpeg to a float's last bits; the bar (0.5 dB, 10 %)
is met with the same margin as the compressor. Nothing is cut.

**For export: the filters with the same parameters as the port.** Anything not named is FFmpeg's default.

| Effect     | Filter                                                                                                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| compressor | `acompressor=threshold=<thresholdDb>dB:ratio=<ratio>:attack=<attackMs>:release=<releaseMs>:knee=<kneeDb>dB:makeup=<makeupDb>dB:detection=peak` |
| gate       | `agate=threshold=<thresholdDb>dB:ratio=<ratio>:attack=<attackMs>:release=<releaseMs>:detection=peak` (knee 2.828427125, range 0.06125)         |
| de-esser   | `deesser=i=<amount>:m=0.5:f=<√(1 − e^(−2π × frequencyHz / 22050))>`                                                                            |
| limiter    | `alimiter=limit=<ceilingDb>dB:attack=5:release=<releaseMs>:level=disabled` (`level` defaults to on, which would raise the output to 0 dBFS)    |
| duck       | `sidechaincompress=threshold=-40dB:ratio=20:attack=<attackMs>:release=<releaseMs>:detection=peak:mix=<1 − 10^(depthDb/20)>`                    |

Ducking has no depth in FFmpeg; `mix` gives it one: the output is `in × (gain × mix + 1 − mix)`, so however
loud the key the track goes down by `depthDb` at most, and at 0 dB nothing happens. The threshold (−40 dBFS)
and ratio (20) are fixed so the key reaches the depth soon after it speaks.

Not run: RMS detection, upward modes, the limiter's `asc`, and the worklet in WebKitGTK (no one listened).
