import { CaptchaOptionError, type RandomSource } from './types';

const defaultRandomSource: RandomSource = (byteLength) => {
  if (!globalThis.crypto?.getRandomValues) {
    throw new CaptchaOptionError(
      'Web Crypto is unavailable. Provide options.randomSource or use a modern browser or Node.js 20+.',
    );
  }

  const bytes = new Uint8Array(byteLength);
  for (let offset = 0; offset < bytes.length; offset += 65_536) {
    globalThis.crypto.getRandomValues(
      bytes.subarray(offset, Math.min(offset + 65_536, bytes.length)),
    );
  }
  return bytes;
};

export class RandomPool {
  readonly #source: RandomSource;
  #pool: Uint8Array = new Uint8Array(0);
  #offset = 0;

  constructor(source: RandomSource = defaultRandomSource) {
    this.#source = source;
  }

  byte(): number {
    if (this.#offset >= this.#pool.length) {
      this.#pool = this.#source(512);
      this.#offset = 0;
      if (!(this.#pool instanceof Uint8Array) || this.#pool.length !== 512) {
        throw new CaptchaOptionError(
          'randomSource must return a Uint8Array of the requested length.',
        );
      }
    }
    return this.#pool[this.#offset++] ?? 0;
  }

  float(): number {
    return ((this.byte() << 16) | (this.byte() << 8) | this.byte()) / 0x1000000;
  }

  integer(min: number, max: number): number {
    if (min === max) return min;
    return min + Math.floor(this.float() * (max - min + 1));
  }

  index(length: number): number {
    const limit = Math.floor(256 / length) * length;
    let value = this.byte();
    while (value >= limit) value = this.byte();
    return value % length;
  }

  shuffle<T>(values: T[]): T[] {
    for (let index = values.length - 1; index > 0; index -= 1) {
      const swapIndex = this.integer(0, index);
      [values[index], values[swapIndex]] = [
        values[swapIndex] as T,
        values[index] as T,
      ];
    }
    return values;
  }
}
