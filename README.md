# afterimage-captcha

Generate display-synced Canvas captchas from complementary television snow frames. Each frame remains 50/50 random static. Pixels inside the glyph mask invert between complementary frames, so the code emerges through visual persistence while the animation is running.

The Canvas player advances exactly once per `requestAnimationFrame` callback. A 60 Hz display therefore presents 60 generated frames per second, while 120 Hz and 144 Hz displays follow their own refresh cadence without a fixed timer.

The package is pure ESM, works in modern browsers and Node.js 20+, and has no runtime dependencies.

## Install

```bash
pnpm add afterimage-captcha
```

## Browser usage

```html
<canvas id="captcha" aria-label="Visual captcha"></canvas>
```

```ts
import {
  createCaptchaPlayer,
  generateCaptcha,
} from 'afterimage-captcha';

const captcha = generateCaptcha({ text: 'R7K2M' });
const canvas = document.querySelector<HTMLCanvasElement>('#captcha')!;
const player = createCaptchaPlayer(canvas, captcha, {
  onRefreshRateChange: (refreshRate) => {
    console.log(`Display refresh: ${refreshRate} Hz`);
  },
});

// Browser-side generation is suitable for previews and low-risk flows.
```

The player starts automatically. It exposes `start()`, `stop()`, `drawFrame(index)`, and `destroy()` together with `running`, `currentFrame`, and the measured `refreshRate`. Pass `{ autoStart: false }` to render only the first frame initially.

When generation happens in a browser, both the answer and generation logic are available to the client. Use browser-side generation for previews or low-risk interactions, not as a server authentication boundary.

## Generate frames only

`generateCaptcha` does not require Canvas and can run in Node.js. It returns the answer, palette-indexed frames, dimensions, and frame count.

```ts
import { generateCaptcha } from 'afterimage-captcha';

const captcha = generateCaptcha({
  length: 6,
  frameCount: 8,
  grainSize: 2,
  signalSpread: 1,
  signalQuietZone: 1,
  temporalNoiseDensity: 0.005,
  snowRefreshRate: 0.04,
});
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `text` | generated | Explicit text to render. Every character must have a glyph. |
| `length` | `5` | Generated answer length, from 1 to 12. Ignored when `text` is set. |
| `charset` | unambiguous A-Z/2-9 | Characters used for generated answers. |
| `width`, `height` | `220`, `80` | Canvas dimensions, from 32 to 1024 pixels. |
| `padding` | `8` | Minimum outer padding in pixels. |
| `scale` | `'auto'` | Integer glyph pixel scale from 1 to 32, or automatic fitting. |
| `characterSpacing` | `2` | Spacing between glyphs in logical pixels. |
| `characterJitter` | `0` | Static per-character offset in logical pixels, from 0 to 4. |
| `signalSpread` | `1` | Expands glyph strokes by 0 to 2 snow grains for a stronger temporal outline. |
| `signalQuietZone` | `1` | Suppresses refresh and temporal noise for 0 to 4 grains around the signal. |
| `frameCount` | `8` | Even number of frames, from 4 to 32. Every snow frame needs a complement. |
| `grainSize` | `2` | Width and height of each television snow grain, from 1 to 8 pixels. |
| `signalStrength` | `1` | Probability that a glyph grain is inverted in each pair, from 0.25 to 1. |
| `temporalNoiseDensity` | `0.005` | Probability that a non-glyph grain outside the quiet zone is also inverted in a pair, from 0 to 0.5. |
| `snowRefreshRate` | `0.04` | Fraction of base snow outside the quiet zone refreshed between frame pairs, from 0 to 1. |
| `darkColor` | `#0a0d0e` | Dark television snow color in hex RGB or RGBA notation. |
| `lightColor` | `#eef2f3` | Light television snow color in hex RGB or RGBA notation. |
| `glyphs` | built-in map | Custom bitmap glyphs merged over the built-in A-Z and 0-9 set. |
| `randomSource` | Web Crypto | Function returning the requested number of random bytes. |

## Custom glyphs

Glyph keys contain one Unicode character. Each glyph is a rectangular array of strings containing only `0` and `1`.

```ts
const captcha = generateCaptcha({
  text: '★',
  glyphs: {
    '★': [
      '00100',
      '10101',
      '01110',
      '11111',
      '01110',
      '10101',
      '00100',
    ],
  },
});
```

## Security and accessibility

Each isolated frame has the same random snow distribution inside and outside the glyph. This raises the cost of systems that inspect isolated frames, but it does not prevent an attacker from comparing complementary frames or aggregating the complete animation. Treat it as one layer in an abuse-control system, not proof that a user is human.

For production use:

- generate and retain the answer on the server;
- expire challenges quickly and accept each challenge once;
- rate-limit generation and verification endpoints;
- compare normalized answers without leaking which character failed;
- provide an accessible non-visual alternative for users who cannot perceive the animation.

## Development

```bash
pnpm run build
pnpm run test
pnpm run lint
pnpm run dev:all
```

The interactive playground runs at `http://localhost:3000` or the next available port.

## License

MIT
