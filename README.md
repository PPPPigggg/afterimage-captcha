# afterimage-captcha

[中文文档](./README.zh-CN.md)

A dependency-free Canvas captcha that renders complementary snow frames at the display refresh rate.

## Install

```bash
pnpm add afterimage-captcha
```

## Usage

```html
<canvas id="captcha"></canvas>
```

```ts
import { createCaptcha } from 'afterimage-captcha';

const canvas = document.querySelector<HTMLCanvasElement>('#captcha')!;
const captcha = createCaptcha(canvas, {
  length: 5,
  frameCount: 8,
  onRefreshRateChange: (rate) => console.log(`${rate} Hz`),
});

console.log(captcha.answer);
captcha.stop();
captcha.start();
captcha.destroy();
```

`createCaptcha(canvas, options)` generates the answer and frames, renders them to the Canvas, and returns the playback controller.

## Captcha options

| Option | Default | Description |
| --- | --- | --- |
| `text` | generated | Explicit answer containing 1–32 built-in A–Z or 0–9 characters. Overrides `length`. |
| `length` | `5` | Length of a generated answer, from 1 to 12. |
| `charset` | `DEFAULT_CHARSET` | Candidate characters for generated answers. Must contain 2–128 built-in A–Z or 0–9 characters. |
| `width` | `220` | Canvas width in pixels, from 32 to 1024. |
| `height` | `80` | Canvas height in pixels, from 32 to 1024. |
| `padding` | `8` | Minimum outer padding in pixels. Its maximum is one third of the shorter canvas side. |
| `scale` | `'auto'` | Number of snow grains occupied by each glyph bitmap cell, from 1 to 32, or automatic fitting. |
| `characterSpacing` | `2` | Gap between characters in glyph bitmap cells, from 0 to 16. |
| `characterJitter` | `0` | Maximum random offset per character in glyph bitmap cells, from 0 to 4. |
| `signalSpread` | `1` | Number of snow grains used to expand glyph strokes, from 0 to 2. |
| `signalQuietZone` | `1` | Stable grains around the signal where refresh and temporal noise are disabled, from 0 to 4. |
| `frameCount` | `8` | Total frame count. Must be an even number from 4 to 32. |
| `grainSize` | `2` | Side length of each snow grain in pixels, from 1 to 8. |
| `signalStrength` | `1` | Probability of inverting a signal grain in a complementary frame, from 0.25 to 1. |
| `temporalNoiseDensity` | `0.005` | Base probability of temporal inversion noise outside the stable area, from 0 to 0.5. |
| `snowRefreshRate` | `0.04` | Base fraction of background snow refreshed between complementary frame pairs, from 0 to 1. |
| `darkColor` | `'#0a0d0e'` | Dark snow color in `#RGB`, `#RGBA`, `#RRGGBB`, or `#RRGGBBAA` format. |
| `lightColor` | `'#eef2f3'` | Light snow color in the same hexadecimal CSS formats. |
| `randomSource` | Web Crypto | Function that returns a `Uint8Array` containing exactly the requested number of random bytes. |
| `autoStart` | `true` | Start display-synced playback immediately. |
| `onRefreshRateChange` | — | Called with the measured display refresh rate in Hz whenever it changes. |

This browser-side visual challenge exposes its answer to the client and only increases automation cost. Do not use it as an authentication boundary; combine it with server-side risk controls, short expiry, attempt limits, and a non-visual alternative.

## Development

```bash
pnpm run build
pnpm run lint
pnpm run playground
```

## License

MIT
