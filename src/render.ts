import { BUILTIN_GLYPHS, DEFAULT_CHARSET } from './glyphs';
import { coherentProbability, PerlinNoise2D } from './perlin';
import { RandomPool } from './random';
import {
  type BitmapGlyph,
  type CaptchaFrame,
  CaptchaOptionError,
  type CaptchaOptions,
  type GlyphMap,
  type RgbaColor,
} from './types';

interface ResolvedOptions {
  answer: string;
  width: number;
  height: number;
  padding: number;
  scale: number;
  characterSpacing: number;
  characterJitter: number;
  signalSpread: number;
  signalQuietZone: number;
  frameCount: number;
  grainSize: number;
  signalStrength: number;
  temporalNoiseDensity: number;
  snowRefreshRate: number;
  glyphs: readonly BitmapGlyph[];
  palette: RgbaColor[];
}

export interface RenderOutput {
  options: ResolvedOptions;
  frames: CaptchaFrame[];
  pairDifferenceMasks: Uint8Array[];
  compositeSignalMask: Uint8Array;
  stabilityMask: Uint8Array;
}

const integerOption = (
  name: string,
  value: number,
  min: number,
  max: number,
): number => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new CaptchaOptionError(
      `${name} must be an integer from ${min} to ${max}.`,
    );
  }
  return value;
};

const numberOption = (
  name: string,
  value: number,
  min: number,
  max: number,
): number => {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new CaptchaOptionError(
      `${name} must be a number from ${min} to ${max}.`,
    );
  }
  return value;
};

const parseColor = (value: string, name: string): RgbaColor => {
  const match = /^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.exec(value);
  if (!match)
    throw new CaptchaOptionError(`${name} must be a hexadecimal CSS color.`);
  let hex = match[1] as string;
  if (hex.length <= 4)
    hex = [...hex].map((character) => character.repeat(2)).join('');
  if (hex.length === 6) hex += 'ff';
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
    Number.parseInt(hex.slice(6, 8), 16),
  ];
};

const validateGlyph = (character: string, glyph: BitmapGlyph): BitmapGlyph => {
  if (glyph.length < 1 || glyph.length > 32) {
    throw new CaptchaOptionError(
      `Glyph ${JSON.stringify(character)} must have 1 to 32 rows.`,
    );
  }
  const width = glyph[0]?.length ?? 0;
  if (
    width < 1 ||
    width > 32 ||
    glyph.some((row) => row.length !== width || !/^[01]+$/.test(row))
  ) {
    throw new CaptchaOptionError(
      `Glyph ${JSON.stringify(character)} must be a rectangular bitmap made of 0 and 1 characters.`,
    );
  }
  return glyph;
};

const buildGlyphMap = (
  customGlyphs: GlyphMap | undefined,
): Map<string, BitmapGlyph> => {
  const glyphs = new Map(Object.entries(BUILTIN_GLYPHS));
  if (!customGlyphs) return glyphs;
  for (const [character, value] of Object.entries(customGlyphs)) {
    if (Array.from(character).length !== 1) {
      throw new CaptchaOptionError(
        'Each glyph key must contain exactly one Unicode character.',
      );
    }
    glyphs.set(character, validateGlyph(character, value));
  }
  return glyphs;
};

const randomText = (
  characters: readonly string[],
  length: number,
  random: RandomPool,
): string => {
  let result = '';
  for (let index = 0; index < length; index += 1) {
    result += characters[random.index(characters.length)];
  }
  return result;
};

const resolveOptions = (
  options: CaptchaOptions,
  random: RandomPool,
): ResolvedOptions => {
  const glyphMap = buildGlyphMap(options.glyphs);
  const charset = Array.from(options.charset ?? DEFAULT_CHARSET);
  if (charset.length < 2 || charset.length > 128) {
    throw new CaptchaOptionError(
      'charset must contain 2 to 128 Unicode characters.',
    );
  }
  const unsupportedCharset = charset.find(
    (character) => !glyphMap.has(character),
  );
  if (unsupportedCharset) {
    throw new CaptchaOptionError(
      `No glyph is available for charset character ${JSON.stringify(unsupportedCharset)}.`,
    );
  }

  const length = integerOption('length', options.length ?? 5, 1, 12);
  const answer = options.text ?? randomText(charset, length, random);
  const characters = Array.from(answer);
  if (characters.length < 1 || characters.length > 32) {
    throw new CaptchaOptionError(
      'text must contain 1 to 32 Unicode characters.',
    );
  }
  const glyphs = characters.map((character) => {
    const value = glyphMap.get(character);
    if (!value) {
      throw new CaptchaOptionError(
        `No glyph is available for text character ${JSON.stringify(character)}.`,
      );
    }
    return validateGlyph(character, value);
  });

  const width = integerOption('width', options.width ?? 220, 32, 1024);
  const height = integerOption('height', options.height ?? 80, 32, 1024);
  const padding = integerOption(
    'padding',
    options.padding ?? 8,
    0,
    Math.floor(Math.min(width, height) / 3),
  );
  const grainSize = integerOption('grainSize', options.grainSize ?? 2, 1, 8);
  const characterSpacing = integerOption(
    'characterSpacing',
    options.characterSpacing ?? 2,
    0,
    16,
  );
  const characterJitter = integerOption(
    'characterJitter',
    options.characterJitter ?? 0,
    0,
    4,
  );
  const signalSpread = integerOption(
    'signalSpread',
    options.signalSpread ?? 1,
    0,
    2,
  );
  const signalQuietZone = integerOption(
    'signalQuietZone',
    options.signalQuietZone ?? 1,
    0,
    4,
  );
  const totalGlyphWidth = glyphs.reduce(
    (sum, value) => sum + (value[0]?.length ?? 0),
    0,
  );
  const layoutWidth =
    totalGlyphWidth +
    characterSpacing * (glyphs.length - 1) +
    characterJitter * 2;
  const layoutHeight =
    Math.max(...glyphs.map((value) => value.length)) + characterJitter * 2;
  const availableWidthInGrains = Math.floor((width - padding * 2) / grainSize);
  const availableHeightInGrains = Math.floor(
    (height - padding * 2) / grainSize,
  );
  const autoScale = Math.floor(
    Math.min(
      (availableWidthInGrains - signalSpread * 2) / layoutWidth,
      (availableHeightInGrains - signalSpread * 2) / layoutHeight,
    ),
  );
  const scale =
    options.scale === undefined || options.scale === 'auto'
      ? autoScale
      : integerOption('scale', options.scale, 1, 32);
  if (
    scale < 1 ||
    layoutWidth * scale + signalSpread * 2 > availableWidthInGrains ||
    layoutHeight * scale + signalSpread * 2 > availableHeightInGrains
  ) {
    throw new CaptchaOptionError(
      'The text does not fit within the requested dimensions and padding.',
    );
  }

  const frameCount = integerOption(
    'frameCount',
    options.frameCount ?? 8,
    4,
    32,
  );
  if (frameCount % 2 !== 0) {
    throw new CaptchaOptionError(
      'frameCount must be even so every snow frame has a complement.',
    );
  }
  const darkColor = parseColor(options.darkColor ?? '#0a0d0e', 'darkColor');
  const lightColor = parseColor(options.lightColor ?? '#eef2f3', 'lightColor');
  if (darkColor.join(',') === lightColor.join(',')) {
    throw new CaptchaOptionError('darkColor and lightColor must be distinct.');
  }

  return {
    answer,
    width,
    height,
    padding,
    scale,
    characterSpacing,
    characterJitter,
    signalSpread,
    signalQuietZone,
    frameCount,
    grainSize,
    signalStrength: numberOption(
      'signalStrength',
      options.signalStrength ?? 1,
      0.25,
      1,
    ),
    temporalNoiseDensity: numberOption(
      'temporalNoiseDensity',
      options.temporalNoiseDensity ?? 0.005,
      0,
      0.5,
    ),
    snowRefreshRate: numberOption(
      'snowRefreshRate',
      options.snowRefreshRate ?? 0.04,
      0,
      1,
    ),
    glyphs,
    palette: [darkColor, lightColor],
  };
};

const fillBlock = (
  pixels: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  size: number,
  value: number,
) => {
  for (let offsetY = 0; offsetY < size; offsetY += 1) {
    const pixelY = y + offsetY;
    if (pixelY < 0 || pixelY >= height) continue;
    for (let offsetX = 0; offsetX < size; offsetX += 1) {
      const pixelX = x + offsetX;
      if (pixelX >= 0 && pixelX < width)
        pixels[pixelY * width + pixelX] = value;
    }
  }
};

const createSignalMask = (
  resolved: ResolvedOptions,
  random: RandomPool,
): Uint8Array => {
  const { width, height, grainSize, scale, characterSpacing, characterJitter } =
    resolved;
  const glyphPixelSize = scale * grainSize;
  const totalWidth =
    (resolved.glyphs.reduce((sum, value) => sum + (value[0]?.length ?? 0), 0) +
      characterSpacing * (resolved.glyphs.length - 1)) *
    glyphPixelSize;
  let cursorX = Math.floor((width - totalWidth) / (grainSize * 2)) * grainSize;
  const mask = new Uint8Array(width * height);

  for (const glyph of resolved.glyphs) {
    const glyphWidth = glyph[0]?.length ?? 0;
    const glyphHeight = glyph.length;
    const jitterX =
      random.integer(-characterJitter, characterJitter) * glyphPixelSize;
    const jitterY =
      random.integer(-characterJitter, characterJitter) * glyphPixelSize;
    const startY =
      Math.floor((height - glyphHeight * glyphPixelSize) / (grainSize * 2)) *
        grainSize +
      jitterY;
    for (const [rowIndex, row] of glyph.entries()) {
      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        if (row[columnIndex] === '1') {
          fillBlock(
            mask,
            width,
            height,
            cursorX + columnIndex * glyphPixelSize + jitterX,
            startY + rowIndex * glyphPixelSize,
            glyphPixelSize,
            1,
          );
        }
      }
    }
    cursorX += (glyphWidth + characterSpacing) * glyphPixelSize;
  }
  return mask;
};

const expandMask = (
  source: Uint8Array,
  width: number,
  height: number,
  grainSize: number,
  radius: number,
): Uint8Array => {
  if (radius === 0) return source;
  const expanded = source.slice();
  const pixelRadius = radius * grainSize;

  for (let y = 0; y < height; y += grainSize) {
    for (let x = 0; x < width; x += grainSize) {
      const centerY = Math.min(y + Math.floor(grainSize / 2), height - 1);
      const centerX = Math.min(x + Math.floor(grainSize / 2), width - 1);
      if (source[centerY * width + centerX] !== 1) continue;
      fillBlock(
        expanded,
        width,
        height,
        x - pixelRadius,
        y - pixelRadius,
        grainSize + pixelRadius * 2,
        1,
      );
    }
  }

  return expanded;
};

export const renderCaptcha = (options: CaptchaOptions = {}): RenderOutput => {
  const random = new RandomPool(options.randomSource);
  const resolved = resolveOptions(options, random);
  const interference = new PerlinNoise2D(random);
  const { width, height, grainSize, frameCount } = resolved;
  const glyphMask = createSignalMask(resolved, random);
  const compositeSignalMask = expandMask(
    glyphMask,
    width,
    height,
    grainSize,
    resolved.signalSpread,
  );
  const stabilityMask = expandMask(
    compositeSignalMask,
    width,
    height,
    grainSize,
    resolved.signalQuietZone,
  );
  const frames: CaptchaFrame[] = [];
  const pairDifferenceMasks: Uint8Array[] = [];
  const baseSnow = new Uint8Array(width * height);

  for (let pairIndex = 0; pairIndex < frameCount / 2; pairIndex += 1) {
    const first = new Uint8Array(width * height);
    const second = new Uint8Array(width * height);
    const differenceMask = new Uint8Array(width * height);

    for (let y = 0; y < height; y += grainSize) {
      for (let x = 0; x < width; x += grainSize) {
        const maskIndex =
          Math.min(y + Math.floor(grainSize / 2), height - 1) * width +
          Math.min(x + Math.floor(grainSize / 2), width - 1);
        const isSignal = compositeSignalMask[maskIndex] === 1;
        const isStable = stabilityMask[maskIndex] === 1;
        const fieldX = x / grainSize / 10 + pairIndex * 0.67;
        const fieldY = y / grainSize / 10 - pairIndex * 0.43;
        const fieldValue = interference.sample(fieldX, fieldY);
        const refreshProbability = coherentProbability(
          resolved.snowRefreshRate,
          fieldValue,
        );
        if (
          pairIndex === 0 ||
          (!isStable && random.float() < refreshProbability)
        ) {
          fillBlock(
            baseSnow,
            width,
            height,
            x,
            y,
            grainSize,
            random.byte() < 128 ? 0 : 1,
          );
        }
        const base = baseSnow[maskIndex] ?? 0;
        const noiseProbability = coherentProbability(
          resolved.temporalNoiseDensity,
          1 - fieldValue,
        );
        const flip = isSignal
          ? random.float() < resolved.signalStrength
          : !isStable && random.float() < noiseProbability;

        fillBlock(first, width, height, x, y, grainSize, base);
        fillBlock(
          second,
          width,
          height,
          x,
          y,
          grainSize,
          flip ? 1 - base : base,
        );
        if (flip) fillBlock(differenceMask, width, height, x, y, grainSize, 1);
      }
    }

    frames.push({ pixels: first }, { pixels: second });
    pairDifferenceMasks.push(differenceMask);
  }

  return {
    options: resolved,
    frames,
    pairDifferenceMasks,
    compositeSignalMask,
    stabilityMask,
  };
};
