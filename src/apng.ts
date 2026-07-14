import { zlibSync } from 'fflate';
import type { CaptchaFrame, RgbaColor } from './types';

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const textEncoder = new TextEncoder();

const uint32 = (value: number): Uint8Array => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value);
  return bytes;
};

const concat = (chunks: readonly Uint8Array[]): Uint8Array => {
  const result = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
};

const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1)
    crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

export const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes)
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

const chunk = (
  type: string,
  data: Uint8Array = new Uint8Array(),
): Uint8Array => {
  const typeBytes = textEncoder.encode(type);
  return concat([
    uint32(data.length),
    typeBytes,
    data,
    uint32(crc32(concat([typeBytes, data]))),
  ]);
};

const frameControl = (
  sequence: number,
  width: number,
  height: number,
  frameDuration: number,
): Uint8Array => {
  const data = new Uint8Array(26);
  const view = new DataView(data.buffer);
  view.setUint32(0, sequence);
  view.setUint32(4, width);
  view.setUint32(8, height);
  view.setUint16(20, frameDuration);
  view.setUint16(22, 1000);
  return data;
};

const scanlines = (
  pixels: Uint8Array,
  width: number,
  height: number,
): Uint8Array => {
  const data = new Uint8Array((width + 1) * height);
  for (let row = 0; row < height; row += 1)
    data.set(
      pixels.subarray(row * width, (row + 1) * width),
      row * (width + 1) + 1,
    );
  return zlibSync(data, { level: 9 });
};

export interface ApngInput {
  width: number;
  height: number;
  frameDuration: number;
  loopCount: number;
  palette: readonly RgbaColor[];
  frames: readonly CaptchaFrame[];
}

export const encodeApng = (input: ApngInput): Uint8Array => {
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer);
  ihdrView.setUint32(0, input.width);
  ihdrView.setUint32(4, input.height);
  ihdr[8] = 8;
  ihdr[9] = 3;

  const palette = new Uint8Array(input.palette.length * 3);
  const transparency = new Uint8Array(input.palette.length);
  let hasTransparency = false;
  for (const [index, color] of input.palette.entries()) {
    palette.set(color.slice(0, 3), index * 3);
    transparency[index] = color[3];
    if (color[3] !== 255) hasTransparency = true;
  }

  const animationControl = concat([
    uint32(input.frames.length),
    uint32(input.loopCount),
  ]);
  const chunks: Uint8Array[] = [
    PNG_SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('PLTE', palette),
  ];
  if (hasTransparency) chunks.push(chunk('tRNS', transparency));
  chunks.push(chunk('acTL', animationControl));

  let sequence = 0;
  for (const [index, frame] of input.frames.entries()) {
    chunks.push(
      chunk(
        'fcTL',
        frameControl(sequence, input.width, input.height, input.frameDuration),
      ),
    );
    sequence += 1;
    const compressed = scanlines(frame.pixels, input.width, input.height);
    if (index === 0) {
      chunks.push(chunk('IDAT', compressed));
    } else {
      chunks.push(chunk('fdAT', concat([uint32(sequence), compressed])));
      sequence += 1;
    }
  }
  chunks.push(chunk('IEND'));
  return concat(chunks);
};

const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export const bytesToDataUrl = (bytes: Uint8Array): string => {
  let encoded = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] as number;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const value = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    encoded += BASE64_ALPHABET[(value >>> 18) & 63];
    encoded += BASE64_ALPHABET[(value >>> 12) & 63];
    encoded += second === undefined ? '=' : BASE64_ALPHABET[(value >>> 6) & 63];
    encoded += third === undefined ? '=' : BASE64_ALPHABET[value & 63];
  }
  return `data:image/apng;base64,${encoded}`;
};
