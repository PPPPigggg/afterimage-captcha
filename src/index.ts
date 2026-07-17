import { createCanvasPlayer } from './canvas.js';
import { renderCaptcha } from './render.js';
import type { Captcha, CaptchaOptions, CaptchaResult } from './types.js';

export { DEFAULT_CHARSET } from './glyphs.js';
export type { Captcha, CaptchaOptions, RandomSource } from './types.js';
export { CaptchaOptionError } from './types.js';

export const createCaptcha = (
  canvas: HTMLCanvasElement,
  options: CaptchaOptions = {},
): Captcha => {
  const rendered = renderCaptcha(options);
  const { width, height, frameCount, palette, answer } = rendered.options;
  const result: CaptchaResult = {
    answer,
    width,
    height,
    frameCount,
    palette,
    frames: rendered.frames,
  };
  const player = createCanvasPlayer(canvas, result, options);

  return {
    answer,
    get refreshRate() {
      return player.refreshRate;
    },
    get running() {
      return player.running;
    },
    start() {
      player.start();
    },
    stop() {
      player.stop();
    },
    destroy() {
      player.destroy();
    },
  };
};
