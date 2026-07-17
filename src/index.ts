import { createCanvasPlayer } from './canvas';
import { renderCaptcha } from './render';
import type { Captcha, CaptchaOptions, CaptchaResult } from './types';

export { DEFAULT_CHARSET } from './glyphs';
export type { Captcha, CaptchaOptions, RandomSource } from './types';
export { CaptchaOptionError } from './types';

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
