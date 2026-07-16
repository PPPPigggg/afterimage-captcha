import {
  type CaptchaCanvasPlayer,
  type CaptchaResult,
  createCaptchaPlayer,
  generateCaptcha,
} from 'afterimage-captcha';
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
const strengthInput = element<HTMLInputElement>('strength');
const noiseInput = element<HTMLInputElement>('noise');
const refreshInput = element<HTMLInputElement>('refresh');
const grainInput = element<HTMLInputElement>('grain');
const jitterInput = element<HTMLInputElement>('jitter');
const spreadInput = element<HTMLInputElement>('spread');
const quietZoneInput = element<HTMLInputElement>('quiet-zone');
const canvas = element<HTMLCanvasElement>('captcha-preview');
const frameNavigation = element<HTMLElement>('frame-nav');
const errorMessage = element<HTMLElement>('error-message');
const status = element<HTMLOutputElement>('status');

let captcha: CaptchaResult;
let player: CaptchaCanvasPlayer;
let frameIndex = 0;
let mode: 'animated' | 'frame' = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches
  ? 'frame'
  : 'animated';
let renderTimer = 0;

const numericValue = (input: HTMLInputElement): number => Number(input.value);
const colorValue = (id: string): string => element<HTMLInputElement>(id).value;

const updateControlLabels = () => {
  element<HTMLOutputElement>('frames-value').value = framesInput.value;
  element<HTMLOutputElement>('strength-value').value =
    `${strengthInput.value}%`;
  element<HTMLOutputElement>('noise-value').value = `${noiseInput.value}%`;
  element<HTMLOutputElement>('refresh-value').value = `${refreshInput.value}%`;
  element<HTMLOutputElement>('grain-value').value = `${grainInput.value} px`;
  element<HTMLOutputElement>('jitter-value').value = jitterInput.value;
  element<HTMLOutputElement>('spread-value').value =
    `${spreadInput.value} grain`;
  element<HTMLOutputElement>('quiet-zone-value').value =
    `${quietZoneInput.value} grain`;
};

const drawFrame = () => {
  if (!player) return;
  player.drawFrame(frameIndex);
  element<HTMLOutputElement>('frame-counter').value =
    `${String(frameIndex + 1).padStart(2, '0')} / ${String(captcha.frameCount).padStart(2, '0')}`;
};

const updateResult = () => {
  player?.destroy();
  frameIndex = 0;
  canvas.style.aspectRatio = `${captcha.width} / ${captcha.height}`;
  element('answer').textContent = captcha.answer;
  element('dimensions-label').textContent =
    `${captcha.width} x ${captcha.height}`;
  element('metric-frames').textContent = String(captcha.frameCount);
  element('metric-signal').textContent = `${strengthInput.value}%`;
  element('metric-refresh').textContent =
    mode === 'animated' ? 'Detecting' : 'Paused';
  element('metric-driver').textContent = mode === 'animated' ? 'rAF' : 'Manual';
  player = createCaptchaPlayer(canvas, captcha, {
    autoStart: mode === 'animated',
    onRefreshRateChange: (refreshRate) => {
      element('metric-refresh').textContent = `${refreshRate} Hz`;
      status.value = `Synced ${refreshRate} Hz`;
    },
  });
  element<HTMLOutputElement>('frame-counter').value =
    `01 / ${String(captcha.frameCount).padStart(2, '0')}`;
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
      signalStrength: numericValue(strengthInput) / 100,
      temporalNoiseDensity: numericValue(noiseInput) / 100,
      snowRefreshRate: numericValue(refreshInput) / 100,
      grainSize: numericValue(grainInput),
      characterJitter: numericValue(jitterInput),
      signalSpread: numericValue(spreadInput),
      signalQuietZone: numericValue(quietZoneInput),
      darkColor: colorValue('dark-color'),
      lightColor: colorValue('light-color'),
    });
    updateResult();
    errorMessage.hidden = true;
    status.value = mode === 'animated' ? 'Syncing' : 'Paused';
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
  frameNavigation.hidden = mode !== 'frame';
  element('mode-label').textContent =
    mode === 'animated' ? 'DISPLAY-SYNCED CANVAS' : 'ISOLATED FRAME';
  element('metric-driver').textContent = mode === 'animated' ? 'rAF' : 'Manual';
  for (const button of document.querySelectorAll<HTMLButtonElement>(
    '.mode-button',
  )) {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  }
  if (!player) return;
  if (mode === 'animated') {
    element('metric-refresh').textContent = 'Detecting';
    status.value = 'Syncing';
    player.start();
  } else {
    player.stop();
    frameIndex = player.currentFrame;
    element('metric-refresh').textContent = 'Paused';
    status.value = 'Paused';
    drawFrame();
  }
};

form.addEventListener('input', queueGenerate);
window.addEventListener('pageshow', queueGenerate);
element<HTMLButtonElement>('regenerate').addEventListener('click', generate);
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
setMode(mode);
