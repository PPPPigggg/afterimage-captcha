import type {
  CaptchaPlayer,
  CaptchaPlayerOptions,
  CaptchaResult,
} from './types.js';

const MIN_REFRESH_SAMPLES = 12;
const MAX_REFRESH_SAMPLES = 60;

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
};

export const createCanvasPlayer = (
  canvas: HTMLCanvasElement,
  captcha: CaptchaResult,
  options: CaptchaPlayerOptions = {},
): CaptchaPlayer => {
  canvas.width = captcha.width;
  canvas.height = captcha.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D rendering is unavailable.');
  context.imageSmoothingEnabled = false;

  const image = context.createImageData(captcha.width, captcha.height);
  const refreshIntervals: number[] = [];
  let animationFrameId: number | null = null;
  let currentFrame = 0;
  let previousTimestamp: number | null = null;
  let refreshRate: number | null = null;
  let running = false;
  let destroyed = false;

  const renderFrame = (frameIndex: number) => {
    const frame = captcha.frames[frameIndex];
    if (!frame) throw new RangeError(`Frame ${frameIndex} does not exist.`);
    for (let index = 0; index < frame.pixels.length; index += 1) {
      const color = captcha.palette[frame.pixels[index] ?? 0];
      if (!color)
        throw new Error('Captcha frame uses an unknown palette index.');
      const offset = index * 4;
      image.data[offset] = color[0];
      image.data[offset + 1] = color[1];
      image.data[offset + 2] = color[2];
      image.data[offset + 3] = color[3];
    }
    context.putImageData(image, 0, 0);
    currentFrame = frameIndex;
  };

  const measureRefreshRate = (timestamp: number) => {
    if (previousTimestamp !== null) {
      const interval = timestamp - previousTimestamp;
      if (interval >= 4 && interval <= 100) {
        refreshIntervals.push(interval);
        if (refreshIntervals.length > MAX_REFRESH_SAMPLES) {
          refreshIntervals.shift();
        }
        if (refreshIntervals.length >= MIN_REFRESH_SAMPLES) {
          const measuredRate = Math.round(1000 / median(refreshIntervals));
          if (measuredRate !== refreshRate) {
            refreshRate = measuredRate;
            options.onRefreshRateChange?.(measuredRate);
          }
        }
      }
    }
    previousTimestamp = timestamp;
  };

  const tick = (timestamp: number) => {
    if (!running) return;
    measureRefreshRate(timestamp);
    renderFrame((currentFrame + 1) % captcha.frameCount);
    animationFrameId = globalThis.requestAnimationFrame(tick);
  };

  const player: CaptchaPlayer = {
    get refreshRate() {
      return refreshRate;
    },
    get running() {
      return running;
    },
    start() {
      if (destroyed) throw new Error('Captcha canvas player is destroyed.');
      if (running) return;
      if (!globalThis.requestAnimationFrame) {
        throw new Error('requestAnimationFrame is unavailable.');
      }
      running = true;
      previousTimestamp = null;
      refreshIntervals.length = 0;
      refreshRate = null;
      animationFrameId = globalThis.requestAnimationFrame(tick);
    },
    stop() {
      if (!running) return;
      running = false;
      if (animationFrameId !== null) {
        globalThis.cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    },
    destroy() {
      player.stop();
      destroyed = true;
      context.clearRect(0, 0, captcha.width, captcha.height);
    },
  };

  renderFrame(0);
  if (options.autoStart !== false) player.start();
  return player;
};
