# afterimage-captcha

[English](./README.md)

一个零运行时依赖的 Canvas 验证码库，按照当前显示器刷新率播放互补雪花帧。

## 安装

```bash
pnpm add afterimage-captcha
```

## 使用

```html
<canvas id="captcha"></canvas>
```

```ts
import { createCaptcha } from 'afterimage-captcha';

const canvas = document.querySelector<HTMLCanvasElement>('#captcha')!;
const captcha = createCaptcha(canvas, {
  length: 5,
  frameCount: 8,
  onRefreshRateChange: (rate) => console.log(`${rate} Hz`),
});

console.log(captcha.answer);
captcha.stop();
captcha.start();
captcha.destroy();
```

`createCaptcha(canvas, options)` 会生成答案和帧、绘制到 Canvas，并返回播放控制器。

## 验证码参数

| 参数 | 默认值 | 作用 |
| --- | --- | --- |
| `text` | 随机生成 | 指定 1–32 个内置 A–Z 或 0–9 字符作为答案；设置后忽略 `length`。 |
| `length` | `5` | 随机答案的字符数，范围为 1–12。 |
| `charset` | `DEFAULT_CHARSET` | 随机答案的候选字符，必须包含 2–128 个内置 A–Z 或 0–9 字符。 |
| `width` | `220` | Canvas 宽度，单位为像素，范围为 32–1024。 |
| `height` | `80` | Canvas 高度，单位为像素，范围为 32–1024。 |
| `padding` | `8` | 验证码与画布边缘的最小距离，单位为像素；最大值为较短边的三分之一。 |
| `scale` | `'auto'` | 每个字形位图单元占用的雪花颗粒数，可设为 1–32 或自动适配。 |
| `characterSpacing` | `2` | 字符间距，单位为字形位图单元，范围为 0–16。 |
| `characterJitter` | `0` | 每个字符的随机偏移上限，单位为字形位图单元，范围为 0–4。 |
| `signalSpread` | `1` | 向外扩展验证码笔画的雪花颗粒数，范围为 0–2。 |
| `signalQuietZone` | `1` | 信号周围不刷新且不加入时序噪声的稳定颗粒数，范围为 0–4。 |
| `frameCount` | `8` | 总帧数，必须是 4–32 之间的偶数。 |
| `grainSize` | `2` | 单个雪花颗粒的边长，单位为像素，范围为 1–8。 |
| `signalStrength` | `1` | 信号颗粒在互补帧中反转的概率，范围为 0.25–1。 |
| `temporalNoiseDensity` | `0.005` | 稳定区域外加入时序反转噪声的基础概率，范围为 0–0.5。 |
| `snowRefreshRate` | `0.04` | 每组互补帧之间刷新背景雪花的基础比例，范围为 0–1。 |
| `darkColor` | `'#0a0d0e'` | 暗色雪花，支持 `#RGB`、`#RGBA`、`#RRGGBB` 和 `#RRGGBBAA`。 |
| `lightColor` | `'#eef2f3'` | 亮色雪花，支持相同的十六进制 CSS 颜色格式。 |
| `randomSource` | Web Crypto | 随机字节生成函数，必须返回长度与请求值完全相同的 `Uint8Array`。 |
| `autoStart` | `true` | 创建后立即按照显示器刷新节奏播放。 |
| `onRefreshRateChange` | — | 检测到的显示器刷新率变化时调用，参数单位为 Hz。 |

该浏览器端视觉验证码会向客户端暴露答案，只能增加自动化成本，不能作为身份认证边界。生产环境仍需结合服务端风控、较短有效期、尝试次数限制和非视觉验证方式。

## 开发

```bash
pnpm run build
pnpm run lint
pnpm run playground
```

## 许可证

MIT
