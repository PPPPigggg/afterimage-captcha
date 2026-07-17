export type RandomSource = (byteLength: number) => Uint8Array;

export type RgbaColor = readonly [
  red: number,
  green: number,
  blue: number,
  alpha: number,
];

/** 验证码内容、尺寸、信号、噪声和播放参数。 */
export interface CaptchaOptions {
  /** 指定 1 到 32 个内置 A-Z 或 0-9 字符；设置后忽略 length。 */
  text?: string;
  /** 随机验证码的字符数，范围为 1 到 12，默认值为 5。 */
  length?: number;
  /** 随机验证码使用的 2 到 128 个内置候选字符，默认排除容易混淆的字母和数字。 */
  charset?: string;
  /** 画布宽度，单位为像素，范围为 32 到 1024，默认值为 220。 */
  width?: number;
  /** 画布高度，单位为像素，范围为 32 到 1024，默认值为 80。 */
  height?: number;
  /** 验证码与画布边缘的最小像素距离，范围上限为画布较短边的三分之一，默认值为 8。 */
  padding?: number;
  /** 字形位图单元占用的雪花颗粒数，范围为 1 到 32，默认自动适配。 */
  scale?: number | 'auto';
  /** 字符间距，单位为字形位图单元，范围为 0 到 16，默认值为 2。 */
  characterSpacing?: number;
  /** 每个字符的随机偏移上限，单位为字形位图单元，范围为 0 到 4，默认值为 0。 */
  characterJitter?: number;
  /** 向外扩展验证码笔画的雪花颗粒数，范围为 0 到 2，默认值为 1。 */
  signalSpread?: number;
  /** 信号周围不刷新且不加入时序噪声的颗粒数，范围为 0 到 4，默认值为 1。 */
  signalQuietZone?: number;
  /** 生成的总帧数，必须是 4 到 32 之间的偶数，默认值为 8。 */
  frameCount?: number;
  /** 单个雪花颗粒的边长，单位为像素，范围为 1 到 8，默认值为 2。 */
  grainSize?: number;
  /** 信号颗粒在互补帧中反转的概率，范围为 0.25 到 1，默认值为 1。 */
  signalStrength?: number;
  /** 非信号区域加入时序反转噪声的基础概率，范围为 0 到 0.5，默认值为 0.005。 */
  temporalNoiseDensity?: number;
  /** 每组互补帧之间刷新背景雪花的基础比例，范围为 0 到 1，默认值为 0.04。 */
  snowRefreshRate?: number;
  /** 暗色雪花的十六进制 CSS 颜色，支持 RGB 或 RGBA 短格式和完整格式，默认值为 #0a0d0e。 */
  darkColor?: string;
  /** 亮色雪花的十六进制 CSS 颜色，支持 RGB 或 RGBA 短格式和完整格式，默认值为 #eef2f3。 */
  lightColor?: string;
  /** 随机字节生成函数，默认使用 Web Crypto。返回长度必须与请求长度一致。 */
  randomSource?: RandomSource;
  /** 创建验证码后是否立即开始播放，默认值为 true。 */
  autoStart?: boolean;
  /** 检测到的显示刷新率发生变化时调用。 */
  onRefreshRateChange?: (refreshRate: number) => void;
}

export interface CaptchaFrame {
  /** 按行优先顺序存储的调色板索引。 */
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

export type CaptchaPlayerOptions = Pick<
  CaptchaOptions,
  'autoStart' | 'onRefreshRateChange'
>;

export interface CaptchaPlayer {
  readonly refreshRate: number | null;
  readonly running: boolean;
  start(): void;
  stop(): void;
  destroy(): void;
}

/** 已创建的 Canvas 验证码及其播放控制器。 */
export interface Captcha extends CaptchaPlayer {
  /** 当前验证码答案。 */
  readonly answer: string;
}

export class CaptchaOptionError extends Error {
  override name = 'CaptchaOptionError';
}
