import { describe, expect, test } from '@rstest/core';
import { unzlibSync } from 'fflate';
import { crc32 } from '../src/apng';
import {
  CaptchaOptionError,
  DEFAULT_CHARSET,
  generateCaptcha,
  type RandomSource,
} from '../src/index';
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

interface PngChunk {
  type: string;
  data: Uint8Array;
  crc: number;
}

const parseChunks = (bytes: Uint8Array): PngChunk[] => {
  const chunks: PngChunk[] = [];
  const decoder = new TextDecoder();
  let offset = 8;
  while (offset < bytes.length) {
    const view = new DataView(bytes.buffer, bytes.byteOffset + offset);
    const length = view.getUint32(0);
    const typeBytes = bytes.subarray(offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    chunks.push({
      type: decoder.decode(typeBytes),
      data,
      crc: new DataView(
        bytes.buffer,
        bytes.byteOffset + offset + 8 + length,
        4,
      ).getUint32(0),
    });
    offset += length + 12;
  }
  return chunks;
};

const countSetPixels = (mask: Uint8Array): number => {
  let count = 0;
  for (const value of mask) count += value === 0 ? 0 : 1;
  return count;
};

describe('generateCaptcha', () => {
  test('generates deterministic APNG bytes for explicit text', () => {
    const options = { text: 'R7K2M', randomSource: seededRandom() };
    const first = generateCaptcha(options);
    const second = generateCaptcha({
      ...options,
      randomSource: seededRandom(),
    });

    expect(first.answer).toBe('R7K2M');
    expect(first.mimeType).toBe('image/apng');
    expect(first.width).toBe(220);
    expect(first.height).toBe(80);
    expect(first.frames).toHaveLength(8);
    expect(first.bytes).toEqual(second.bytes);
    expect([...first.bytes.slice(0, 8)]).toEqual([
      137, 80, 78, 71, 13, 10, 26, 10,
    ]);
    expect(first.dataUrl).toMatch(/^data:image\/apng;base64,iVBORw0KGgo/);
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
    expect(parseChunks(result.bytes).map((chunk) => chunk.type)).toContain(
      'tRNS',
    );
  });

  test.each([
    [{ text: '' }, 'text'],
    [{ text: 'a' }, 'No glyph'],
    [{ frameCount: 7 }, 'even'],
    [{ signalStrength: 0.1 }, 'signalStrength'],
    [{ width: 32, text: 'ABCDE' }, 'does not fit'],
    [{ darkColor: 'black' }, 'hexadecimal'],
    [{ darkColor: '#fff', lightColor: '#ffffff' }, 'distinct'],
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
      text: 'APNG8',
      randomSource: seededRandom(),
    });
    const signatures = output.frames.map((frame) => crc32(frame.pixels));
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
});

describe('APNG encoding', () => {
  test('writes valid animation chunks, sequence numbers, CRCs, and scanlines', () => {
    const result = generateCaptcha({
      text: 'CRC8',
      width: 144,
      height: 64,
      frameCount: 6,
      frameDuration: 90,
      loopCount: 3,
      randomSource: seededRandom(),
    });
    const chunks = parseChunks(result.bytes);
    const types = chunks.map((chunk) => chunk.type);

    expect(types.slice(0, 4)).toEqual(['IHDR', 'PLTE', 'acTL', 'fcTL']);
    expect(types.at(-1)).toBe('IEND');
    expect(types.filter((type) => type === 'fcTL')).toHaveLength(6);
    expect(types.filter((type) => type === 'IDAT')).toHaveLength(1);
    expect(types.filter((type) => type === 'fdAT')).toHaveLength(5);

    const animationControl = chunks.find(
      (chunk) => chunk.type === 'acTL',
    )?.data;
    expect(
      new DataView(
        animationControl?.buffer as ArrayBuffer,
        animationControl?.byteOffset,
        8,
      ).getUint32(0),
    ).toBe(6);
    expect(
      new DataView(
        animationControl?.buffer as ArrayBuffer,
        animationControl?.byteOffset,
        8,
      ).getUint32(4),
    ).toBe(3);

    const sequenceNumbers = chunks
      .filter((chunk) => chunk.type === 'fcTL' || chunk.type === 'fdAT')
      .map((chunk) =>
        new DataView(chunk.data.buffer, chunk.data.byteOffset, 4).getUint32(0),
      );
    expect(sequenceNumbers).toEqual(
      Array.from({ length: 11 }, (_, index) => index),
    );

    for (const current of chunks) {
      const typeBytes = new TextEncoder().encode(current.type);
      const crcInput = new Uint8Array(typeBytes.length + current.data.length);
      crcInput.set(typeBytes);
      crcInput.set(current.data, typeBytes.length);
      expect(current.crc).toBe(crc32(crcInput));

      if (current.type === 'IDAT' || current.type === 'fdAT') {
        const compressed =
          current.type === 'IDAT' ? current.data : current.data.subarray(4);
        expect(unzlibSync(compressed)).toHaveLength(
          (result.width + 1) * result.height,
        );
      }
    }
  });
});
