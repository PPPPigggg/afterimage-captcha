export { createCaptchaPlayer } from './canvas';

import { renderCaptcha } from './render';
import type { CaptchaOptions, CaptchaResult } from './types';

export { DEFAULT_CHARSET } from './glyphs';
export type {
  BitmapGlyph,
  CaptchaCanvasPlayer,
  CaptchaCanvasPlayerOptions,
  CaptchaFrame,
  CaptchaOptions,
  CaptchaResult,
  GlyphMap,
  RandomSource,
  RgbaColor,
} from './types';
export { CaptchaOptionError } from './types';

export const generateCaptcha = (
  options: CaptchaOptions = {},
): CaptchaResult => {
  const rendered = renderCaptcha(options);
  const { width, height, frameCount, palette, answer } = rendered.options;

  return {
    answer,
    width,
    height,
    frameCount,
    palette,
    frames: rendered.frames,
  };
};
