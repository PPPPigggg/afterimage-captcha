import type { RandomPool } from './random.js';

const fade = (value: number): number =>
  value * value * value * (value * (value * 6 - 15) + 10);

const interpolate = (from: number, to: number, amount: number): number =>
  from + (to - from) * amount;

const gradient = (hash: number, x: number, y: number): number => {
  switch (hash & 3) {
    case 0:
      return x + y;
    case 1:
      return -x + y;
    case 2:
      return x - y;
    default:
      return -x - y;
  }
};

export class PerlinNoise2D {
  readonly #permutation: Uint8Array;

  constructor(random: RandomPool) {
    const values = random.shuffle(
      Array.from({ length: 256 }, (_, index) => index),
    );
    this.#permutation = new Uint8Array(512);
    for (let index = 0; index < this.#permutation.length; index += 1) {
      this.#permutation[index] = values[index & 255] as number;
    }
  }

  sample(x: number, y: number): number {
    const cellX = Math.floor(x) & 255;
    const cellY = Math.floor(y) & 255;
    const localX = x - Math.floor(x);
    const localY = y - Math.floor(y);
    const fadedX = fade(localX);
    const fadedY = fade(localY);
    const bottomLeft = this.#permutation[
      (this.#permutation[cellX] as number) + cellY
    ] as number;
    const bottomRight = this.#permutation[
      (this.#permutation[cellX + 1] as number) + cellY
    ] as number;
    const topLeft = this.#permutation[
      (this.#permutation[cellX] as number) + cellY + 1
    ] as number;
    const topRight = this.#permutation[
      (this.#permutation[cellX + 1] as number) + cellY + 1
    ] as number;
    const bottom = interpolate(
      gradient(bottomLeft, localX, localY),
      gradient(bottomRight, localX - 1, localY),
      fadedX,
    );
    const top = interpolate(
      gradient(topLeft, localX, localY - 1),
      gradient(topRight, localX - 1, localY - 1),
      fadedX,
    );

    return Math.max(0, Math.min(1, interpolate(bottom, top, fadedY) / 2 + 0.5));
  }
}

export const coherentProbability = (
  probability: number,
  fieldValue: number,
): number => {
  const headroom = Math.min(probability, 1 - probability);
  return probability + (fieldValue * 2 - 1) * headroom * 0.9;
};
