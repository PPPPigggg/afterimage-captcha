# afterimage-captcha

Generate animated PNG captchas from complementary television snow frames. Every individual frame is 50/50 random static. Within each frame pair, pixels inside the glyph mask are inverted while other pixels stay unchanged, so the code appears through visual persistence only during continuous playback.

The package is pure ESM, works in modern browsers and Node.js 20+, and does not require Canvas or native image dependencies.

## Install

```bash
pnpm add afterimage-captcha
```

## Usage

### Node.js

Generate the image on the server, store `answer` in a short-lived session, and send only the APNG bytes to the client.

```ts
import { generateCaptcha } from 'afterimage-captcha';

const captcha = generateCaptcha({
  length: 6,
  frameCount: 10,
  frameDuration: 50,
  grainSize: 2,
  temporalNoiseDensity: 0.01,
  snowRefreshRate: 0.12,
});

response.setHeader('Content-Type', captcha.mimeType);
response.end(captcha.bytes);

// Store captcha.answer server-side with a short expiry.
```

### Browser

```ts
import { generateCaptcha } from 'afterimage-captcha';

const captcha = generateCaptcha({ text: 'R7K2M' });
document.querySelector('img')!.src = captcha.dataUrl;
```

When generation happens in a browser, both the answer and generation logic are available to the client. Use browser-side generation for previews or low-risk interactions, not as a server authentication boundary.

## Options

```ts
const captcha = generateCaptcha({
  text: 'AFTER',
  width: 240,
  height: 88,
  frameCount: 8,
  frameDuration: 50,
  grainSize: 2,
  signalStrength: 1,
  temporalNoiseDensity: 0.01,
  snowRefreshRate: 0.12,
  darkColor: '#0a0d0e',
  lightColor: '#eef2f3',
});
```

| Option | Default | Description |
| --- | --- | --- |
| `text` | generated | Explicit text to render. Every character must have a glyph. |
| `length` | `5` | Generated answer length, from 1 to 12. Ignored when `text` is set. |
| `charset` | unambiguous A-Z/2-9 | Characters used for generated answers. |
| `width`, `height` | `220`, `80` | Output dimensions, from 32 to 1024 pixels. |
| `padding` | `8` | Minimum outer padding in pixels. |
| `scale` | `'auto'` | Integer glyph pixel scale from 1 to 32, or automatic fitting. |
| `characterSpacing` | `1` | Spacing between glyphs in logical pixels. |
| `characterJitter` | `1` | Static per-character offset in logical pixels, from 0 to 4. |
| `frameCount` | `8` | Even number of APNG frames, from 4 to 32. Every snow frame needs a complement. |
| `frameDuration` | `50` | Duration of each frame, from 20 to 2000 milliseconds. |
| `loopCount` | `0` | APNG loop count. Zero repeats indefinitely. |
| `grainSize` | `2` | Width and height of each television snow grain, from 1 to 8 pixels. |
| `signalStrength` | `1` | Probability that a glyph grain is inverted in each pair, from 0.25 to 1. |
| `temporalNoiseDensity` | `0.01` | Probability that a non-glyph grain is also inverted in a pair, from 0 to 0.5. |
| `snowRefreshRate` | `0.12` | Fraction of the base snow refreshed between frame pairs, from 0 to 1. Lower values make the code easier to perceive. |
| `darkColor` | `#0a0d0e` | Dark television snow color in hex RGB or RGBA notation. |
| `lightColor` | `#eef2f3` | Light television snow color in hex RGB or RGBA notation. |
| `glyphs` | built-in map | Custom bitmap glyphs merged over the built-in A-Z and 0-9 set. |
| `randomSource` | Web Crypto | Function returning the requested number of random bytes. |

The result includes the encoded `bytes`, a browser-ready `dataUrl`, palette-indexed `frames`, dimensions, timing metadata, and `answer`.

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

Each isolated frame has the same random snow distribution inside and outside the glyph. This raises the cost of OCR systems that inspect isolated frames, but it does not prevent an attacker from comparing complementary pairs or aggregating the complete animation. Treat it as one layer in an abuse-control system, not proof that a user is human.

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

The interactive playground runs at `http://localhost:3000`.

## License

MIT
