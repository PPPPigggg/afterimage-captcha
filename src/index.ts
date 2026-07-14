import { bytesToDataUrl, encodeApng } from './apng';
import { renderCaptcha } from './render';
import type { CaptchaOptions, CaptchaResult } from './types';

export { DEFAULT_CHARSET } from './glyphs';
export type {
  BitmapGlyph,
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
  const {
    width,
    height,
    frameCount,
    frameDuration,
    loopCount,
    palette,
    answer,
  } = rendered.options;
  const bytes = encodeApng({
    width,
    height,
    frameDuration,
    loopCount,
    palette,
    frames: rendered.frames,
  });

  return {
    answer,
    bytes,
    dataUrl: bytesToDataUrl(bytes),
    mimeType: 'image/apng',
    width,
    height,
    frameCount,
    frameDuration,
    loopCount,
    palette,
    frames: rendered.frames,
  };
};
