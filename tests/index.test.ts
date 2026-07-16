import { describe, expect, test } from '@rstest/core';
import {
  CaptchaOptionError,
  type CaptchaResult,
  createCaptchaPlayer,
  DEFAULT_CHARSET,
  generateCaptcha,
  type RandomSource,
} from '../src/index';
import { coherentProbability, PerlinNoise2D } from '../src/perlin';
import { RandomPool } from '../src/random';
import { renderCaptcha } from '../src/render';

const seededRandom = (initialSeed = 0x12345678): RandomSource => {
  let state = initialSeed >>> 0;
  return (length) => {
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
      bytes[index] = state >>> 24;
    }
    return bytes;
  };
};

const countSetPixels = (mask: Uint8Array): number => {
  let count = 0;
  for (const value of mask) count += value === 0 ? 0 : 1;
  return count;
};

const pixelChecksum = (pixels: Uint8Array): number => {
  let hash = 2_166_136_261;
  for (const value of pixels) {
    hash ^= value;
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
};

describe('coherent temporal noise', () => {
  test('produces deterministic, continuous Perlin probability fields', () => {
    const first = new PerlinNoise2D(new RandomPool(seededRandom()));
    const second = new PerlinNoise2D(new RandomPool(seededRandom()));
    const sample = first.sample(3.25, 7.75);
    const nearbySample = first.sample(3.26, 7.76);

    expect(sample).toBe(second.sample(3.25, 7.75));
    expect(sample).toBeGreaterThanOrEqual(0);
    expect(sample).toBeLessThanOrEqual(1);
    expect(Math.abs(sample - nearbySample)).toBeLessThan(0.05);
  });

  test('preserves probability endpoints while applying spatial bias', () => {
    expect(coherentProbability(0, 1)).toBe(0);
    expect(coherentProbability(1, 0)).toBe(1);
    expect(coherentProbability(0.1, 0)).toBeLessThan(0.1);
    expect(coherentProbability(0.1, 1)).toBeGreaterThan(0.1);
  });
});

describe('generateCaptcha', () => {
  test('generates deterministic complementary frames for explicit text', () => {
    const options = { text: 'R7K2M', randomSource: seededRandom() };
    const first = generateCaptcha(options);
    const second = generateCaptcha({
      ...options,
      randomSource: seededRandom(),
    });

    expect(first.answer).toBe('R7K2M');
    expect(first.width).toBe(220);
    expect(first.height).toBe(80);
    expect(first.frames).toHaveLength(8);
    expect(first.frames).toEqual(second.frames);
    expect(first.palette).toEqual(second.palette);
  });

  test('generates an answer from a custom charset without modulo bias fallback', () => {
    const result = generateCaptcha({
      charset: 'AB',
      length: 12,
      randomSource: seededRandom(9),
    });

    expect(result.answer).toHaveLength(12);
    expect(result.answer).toMatch(/^[AB]+$/);
    expect(DEFAULT_CHARSET).not.toMatch(/[01IO]/);
  });

  test('supports custom Unicode bitmap glyphs and transparent colors', () => {
    const result = generateCaptcha({
      text: '★',
      glyphs: {
        '★': ['00100', '10101', '01110', '11111', '01110', '10101', '00100'],
      },
      darkColor: '#0000',
      lightColor: '#eef2f3',
      randomSource: seededRandom(),
    });

    expect(result.answer).toBe('★');
    expect(result.palette[0]?.[3]).toBe(0);
  });

  test.each([
    [{ text: '' }, 'text'],
    [{ text: 'a' }, 'No glyph'],
    [{ frameCount: 7 }, 'even'],
    [{ signalStrength: 0.1 }, 'signalStrength'],
    [{ width: 32, text: 'ABCDE' }, 'does not fit'],
    [{ darkColor: 'black' }, 'hexadecimal'],
    [{ darkColor: '#fff', lightColor: '#ffffff' }, 'distinct'],
    [{ signalSpread: 3 }, 'signalSpread'],
    [{ signalQuietZone: 5 }, 'signalQuietZone'],
    [{ glyphs: { X: ['10', '1'] } }, 'rectangular'],
  ])('rejects invalid options %#', (options, message) => {
    expect(() =>
      generateCaptcha({ ...options, randomSource: seededRandom() }),
    ).toThrow(message);
  });

  test('rejects random sources that violate their contract', () => {
    expect(() =>
      generateCaptcha({ randomSource: () => new Uint8Array(1) }),
    ).toThrow(CaptchaOptionError);
  });
});

describe('temporal frame rendering', () => {
  test('encodes the glyph only in complementary frame differences', () => {
    const output = renderCaptcha({
      text: 'AFTER',
      frameCount: 8,
      signalStrength: 1,
      temporalNoiseDensity: 0,
      characterJitter: 0,
      randomSource: seededRandom(),
    });
    const compositeCount = countSetPixels(output.compositeSignalMask);

    expect(compositeCount).toBeGreaterThan(0);
    expect(output.pairDifferenceMasks).toHaveLength(4);
    for (const [
      pairIndex,
      differenceMask,
    ] of output.pairDifferenceMasks.entries()) {
      expect(differenceMask).toEqual(output.compositeSignalMask);
      const first = output.frames[pairIndex * 2]?.pixels;
      const second = output.frames[pairIndex * 2 + 1]?.pixels;
      expect(first).toBeDefined();
      expect(second).toBeDefined();
      for (let index = 0; index < differenceMask.length; index += 1) {
        expect((first?.[index] ?? 0) ^ (second?.[index] ?? 0)).toBe(
          differenceMask[index],
        );
      }
    }
  });

  test('creates dense, visually distinct television snow frames', () => {
    const output = renderCaptcha({
      text: 'SNOW8',
      randomSource: seededRandom(),
    });
    const signatures = output.frames.map((frame) =>
      pixelChecksum(frame.pixels),
    );
    expect(new Set(signatures).size).toBe(output.frames.length);
    for (const frame of output.frames) {
      const lightRatio =
        frame.pixels.reduce((sum, value) => sum + value, 0) /
        frame.pixels.length;
      expect(lightRatio).toBeGreaterThan(0.35);
      expect(lightRatio).toBeLessThan(0.65);
    }

    const firstPairBase = output.frames[0]?.pixels;
    const nextPairBase = output.frames[2]?.pixels;
    let unchanged = 0;
    for (let index = 0; index < (firstPairBase?.length ?? 0); index += 1) {
      if (firstPairBase?.[index] === nextPairBase?.[index]) unchanged += 1;
    }
    const unchangedRatio = unchanged / (firstPairBase?.length ?? 1);
    expect(unchangedRatio).toBeGreaterThan(0.85);
    expect(unchangedRatio).toBeLessThan(1);
  });

  test('expands glyph strokes and protects their surrounding quiet zone', () => {
    const base = renderCaptcha({
      text: 'R7K2M',
      signalSpread: 0,
      signalQuietZone: 0,
      randomSource: seededRandom(),
    });
    const clear = renderCaptcha({
      text: 'R7K2M',
      signalSpread: 1,
      signalQuietZone: 1,
      randomSource: seededRandom(),
    });

    expect(countSetPixels(clear.compositeSignalMask)).toBeGreaterThan(
      countSetPixels(base.compositeSignalMask),
    );
    expect(countSetPixels(clear.stabilityMask)).toBeGreaterThan(
      countSetPixels(clear.compositeSignalMask),
    );
    for (let index = 0; index < clear.compositeSignalMask.length; index += 1) {
      if (clear.compositeSignalMask[index] === 1) {
        expect(clear.stabilityMask[index]).toBe(1);
      }
    }
  });

  test('keeps quiet-zone snow stable while refreshing the outer field', () => {
    const output = renderCaptcha({
      text: 'AFTER',
      frameCount: 8,
      signalStrength: 1,
      signalSpread: 0,
      signalQuietZone: 2,
      temporalNoiseDensity: 0.5,
      snowRefreshRate: 1,
      randomSource: seededRandom(),
    });
    const firstBase = output.frames[0]?.pixels;
    let protectedBackgroundPixels = 0;

    for (let index = 0; index < output.stabilityMask.length; index += 1) {
      if (
        output.stabilityMask[index] !== 1 ||
        output.compositeSignalMask[index] === 1
      ) {
        continue;
      }
      protectedBackgroundPixels += 1;
      for (
        let pairIndex = 1;
        pairIndex < output.options.frameCount / 2;
        pairIndex += 1
      ) {
        expect(output.frames[pairIndex * 2]?.pixels[index]).toBe(
          firstBase?.[index],
        );
        expect(output.pairDifferenceMasks[pairIndex]?.[index]).toBe(0);
      }
    }

    expect(protectedBackgroundPixels).toBeGreaterThan(0);
  });
});

describe('canvas playback', () => {
  test('advances one frame per display refresh and measures its rate', () => {
    const callbacks = new Map<number, FrameRequestCallback>();
    const drawnColors: number[] = [];
    const measuredRates: number[] = [];
    let nextCallbackId = 0;
    let cleared = false;
    const originalRequest = globalThis.requestAnimationFrame;
    const originalCancel = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = (callback) => {
      nextCallbackId += 1;
      callbacks.set(nextCallbackId, callback);
      return nextCallbackId;
    };
    globalThis.cancelAnimationFrame = (callbackId) => {
      callbacks.delete(callbackId);
    };

    const context = {
      imageSmoothingEnabled: true,
      createImageData: (width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      }),
      putImageData: (image: ImageData) => {
        drawnColors.push(image.data[0] as number);
      },
      clearRect: () => {
        cleared = true;
      },
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => context,
    } as unknown as HTMLCanvasElement;
    const captcha: CaptchaResult = {
      answer: 'AB',
      width: 1,
      height: 1,
      frameCount: 2,
      palette: [
        [0, 0, 0, 255],
        [255, 255, 255, 255],
      ],
      frames: [
        { pixels: new Uint8Array([0]) },
        { pixels: new Uint8Array([1]) },
      ],
    };

    try {
      const player = createCaptchaPlayer(canvas, captcha, {
        autoStart: false,
        onRefreshRateChange: (refreshRate) => measuredRates.push(refreshRate),
      });
      expect(drawnColors).toEqual([0]);
      expect(player.currentFrame).toBe(0);

      player.start();
      for (let index = 1; index <= 13; index += 1) {
        const callback = callbacks.values().next()
          .value as FrameRequestCallback;
        callbacks.clear();
        callback(index * (1000 / 120));
      }

      expect(drawnColors.slice(0, 4)).toEqual([0, 255, 0, 255]);
      expect(player.refreshRate).toBe(120);
      expect(measuredRates.at(-1)).toBe(120);
      expect(player.running).toBe(true);

      player.stop();
      expect(player.running).toBe(false);
      player.drawFrame(1);
      expect(player.currentFrame).toBe(1);
      player.destroy();
      expect(cleared).toBe(true);
    } finally {
      globalThis.requestAnimationFrame = originalRequest;
      globalThis.cancelAnimationFrame = originalCancel;
    }
  });
});
