export type BitmapGlyph = readonly string[];

export type GlyphMap = Readonly<Record<string, BitmapGlyph>>;

export type RandomSource = (byteLength: number) => Uint8Array;

export type RgbaColor = readonly [
  red: number,
  green: number,
  blue: number,
  alpha: number,
];

export interface CaptchaOptions {
  text?: string;
  length?: number;
  charset?: string;
  width?: number;
  height?: number;
  padding?: number;
  scale?: number | 'auto';
  characterSpacing?: number;
  characterJitter?: number;
  signalSpread?: number;
  signalQuietZone?: number;
  frameCount?: number;
  grainSize?: number;
  signalStrength?: number;
  temporalNoiseDensity?: number;
  snowRefreshRate?: number;
  darkColor?: string;
  lightColor?: string;
  glyphs?: GlyphMap;
  randomSource?: RandomSource;
}

export interface CaptchaFrame {
  /** Palette indexes in row-major order. */
  pixels: Uint8Array;
}

export interface CaptchaResult {
  answer: string;
  width: number;
  height: number;
  frameCount: number;
  palette: readonly RgbaColor[];
  frames: readonly CaptchaFrame[];
}

export interface CaptchaCanvasPlayerOptions {
  autoStart?: boolean;
  onRefreshRateChange?: (refreshRate: number) => void;
}

export interface CaptchaCanvasPlayer {
  readonly currentFrame: number;
  readonly refreshRate: number | null;
  readonly running: boolean;
  start(): void;
  stop(): void;
  drawFrame(frameIndex: number): void;
  destroy(): void;
}

export class CaptchaOptionError extends Error {
  override name = 'CaptchaOptionError';
}
