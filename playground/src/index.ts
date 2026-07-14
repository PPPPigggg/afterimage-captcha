import { type CaptchaResult, generateCaptcha } from 'afterimage-captcha';
import './style.css';

const element = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing element #${id}`);
  return value as T;
};

const form = element<HTMLFormElement>('options-form');
const textInput = element<HTMLInputElement>('text');
const widthInput = element<HTMLInputElement>('width');
const heightInput = element<HTMLInputElement>('height');
const framesInput = element<HTMLInputElement>('frames');
const durationInput = element<HTMLInputElement>('duration');
const strengthInput = element<HTMLInputElement>('strength');
const noiseInput = element<HTMLInputElement>('noise');
const refreshInput = element<HTMLInputElement>('refresh');
const grainInput = element<HTMLInputElement>('grain');
const jitterInput = element<HTMLInputElement>('jitter');
const animatedPreview = element<HTMLImageElement>('animated-preview');
const framePreview = element<HTMLCanvasElement>('frame-preview');
const frameNavigation = element<HTMLElement>('frame-nav');
const errorMessage = element<HTMLElement>('error-message');
const status = element<HTMLOutputElement>('status');

let captcha: CaptchaResult;
let frameIndex = 0;
let mode: 'animated' | 'frame' = 'animated';
let renderTimer = 0;

const numericValue = (input: HTMLInputElement): number => Number(input.value);
const colorValue = (id: string): string => element<HTMLInputElement>(id).value;

const updateControlLabels = () => {
  element<HTMLOutputElement>('frames-value').value = framesInput.value;
  element<HTMLOutputElement>('duration-value').value =
    `${durationInput.value} ms`;
  element<HTMLOutputElement>('strength-value').value =
    `${strengthInput.value}%`;
  element<HTMLOutputElement>('noise-value').value = `${noiseInput.value}%`;
  element<HTMLOutputElement>('refresh-value').value = `${refreshInput.value}%`;
  element<HTMLOutputElement>('grain-value').value = `${grainInput.value} px`;
  element<HTMLOutputElement>('jitter-value').value = jitterInput.value;
};

const drawFrame = () => {
  if (!captcha) return;
  const context = framePreview.getContext('2d');
  if (!context) return;
  const frame = captcha.frames[frameIndex];
  if (!frame) return;
  framePreview.width = captcha.width;
  framePreview.height = captcha.height;
  const image = context.createImageData(captcha.width, captcha.height);
  for (let index = 0; index < frame.pixels.length; index += 1) {
    const color = captcha.palette[frame.pixels[index] ?? 0] ?? [0, 0, 0, 255];
    const offset = index * 4;
    image.data[offset] = color[0];
    image.data[offset + 1] = color[1];
    image.data[offset + 2] = color[2];
    image.data[offset + 3] = color[3];
  }
  context.putImageData(image, 0, 0);
  element<HTMLOutputElement>('frame-counter').value =
    `${String(frameIndex + 1).padStart(2, '0')} / ${String(captcha.frameCount).padStart(2, '0')}`;
};

const updateResult = () => {
  frameIndex = 0;
  animatedPreview.src = captcha.dataUrl;
  animatedPreview.width = captcha.width;
  animatedPreview.height = captcha.height;
  framePreview.style.aspectRatio = `${captcha.width} / ${captcha.height}`;
  element('answer').textContent = captcha.answer;
  element('dimensions-label').textContent =
    `${captcha.width} x ${captcha.height}`;
  element('metric-frames').textContent = String(captcha.frameCount);
  element('metric-cycle').textContent =
    `${captcha.frameCount * captcha.frameDuration} ms`;
  element('metric-signal').textContent = `${strengthInput.value}%`;
  element('metric-size').textContent =
    `${(captcha.bytes.length / 1024).toFixed(1)} KB`;
  drawFrame();
};

const generate = () => {
  updateControlLabels();
  try {
    const requestedText = textInput.value.trim().toUpperCase();
    textInput.value = requestedText;
    captcha = generateCaptcha({
      text: requestedText || undefined,
      width: numericValue(widthInput),
      height: numericValue(heightInput),
      frameCount: numericValue(framesInput),
      frameDuration: numericValue(durationInput),
      signalStrength: numericValue(strengthInput) / 100,
      temporalNoiseDensity: numericValue(noiseInput) / 100,
      snowRefreshRate: numericValue(refreshInput) / 100,
      grainSize: numericValue(grainInput),
      characterJitter: numericValue(jitterInput),
      darkColor: colorValue('dark-color'),
      lightColor: colorValue('light-color'),
    });
    updateResult();
    errorMessage.hidden = true;
    status.value = 'Generated';
  } catch (error) {
    errorMessage.textContent =
      error instanceof Error ? error.message : String(error);
    errorMessage.hidden = false;
    status.value = 'Invalid options';
  }
};

const queueGenerate = () => {
  window.clearTimeout(renderTimer);
  renderTimer = window.setTimeout(generate, 90);
};

const setMode = (nextMode: 'animated' | 'frame') => {
  mode = nextMode;
  animatedPreview.hidden = mode !== 'animated';
  framePreview.hidden = mode !== 'frame';
  frameNavigation.hidden = mode !== 'frame';
  element('mode-label').textContent =
    mode === 'animated' ? 'ANIMATED APNG' : 'ISOLATED FRAME';
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '.mode-button',
  )) {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  if (mode === 'frame') drawFrame();
};

form.addEventListener('input', queueGenerate);
window.addEventListener('pageshow', queueGenerate);
element<HTMLButtonElement>('regenerate').addEventListener('click', generate);
element<HTMLButtonElement>('download').addEventListener('click', () => {
  const blob = new Blob([captcha.bytes.slice().buffer], {
    type: captcha.mimeType,
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `afterimage-${captcha.answer}.png`;
  anchor.click();
  URL.revokeObjectURL(url);
});
element<HTMLButtonElement>('previous-frame').addEventListener('click', () => {
  frameIndex = (frameIndex - 1 + captcha.frameCount) % captcha.frameCount;
  drawFrame();
});
element<HTMLButtonElement>('next-frame').addEventListener('click', () => {
  frameIndex = (frameIndex + 1) % captcha.frameCount;
  drawFrame();
});
for (const button of document.querySelectorAll<HTMLButtonElement>(
  '.mode-button',
)) {
  button.addEventListener('click', () =>
    setMode(button.dataset.mode === 'frame' ? 'frame' : 'animated'),
  );
}

updateControlLabels();
generate();
setMode(
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'frame'
    : 'animated',
);
