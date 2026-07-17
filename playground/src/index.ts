import {
  type Captcha,
  type CaptchaOptions,
  createCaptcha,
} from 'afterimage-captcha';
import './style.css';

const element = <T extends HTMLElement>(id: string): T => {
  const value = document.getElementById(id);
  if (!value) throw new Error(`缺少页面元素 #${id}`);
  return value as T;
};

const form = element<HTMLFormElement>('form');
const canvas = element<HTMLCanvasElement>('captcha');
const status = element<HTMLOutputElement>('status');
const answer = element<HTMLOutputElement>('answer');
const refreshRate = element<HTMLOutputElement>('refresh-rate');
const errorMessage = element<HTMLElement>('error');
const widthInput = element<HTMLInputElement>('width');
const heightInput = element<HTMLInputElement>('height');
const paddingInput = element<HTMLInputElement>('padding');
const rangeInputs = form.querySelectorAll<HTMLInputElement>(
  'input[type="range"]',
);
let captcha: Captcha | undefined;
let generatedAnswer: string | undefined;
let pendingGeneration: number | undefined;

const readOptions = (): CaptchaOptions => {
  const data = new FormData(form);
  const stringValue = (name: string) => String(data.get(name) ?? '').trim();
  const numberValue = (name: string) => Number(stringValue(name));
  const text = stringValue('text');
  const charset = stringValue('charset');
  const scale = stringValue('scale');

  return {
    text: text || undefined,
    length: numberValue('length'),
    charset: charset || undefined,
    width: numberValue('width'),
    height: numberValue('height'),
    padding: numberValue('padding'),
    scale: scale === '0' ? 'auto' : Number(scale),
    characterSpacing: numberValue('characterSpacing'),
    characterJitter: numberValue('characterJitter'),
    signalSpread: numberValue('signalSpread'),
    signalQuietZone: numberValue('signalQuietZone'),
    frameCount: numberValue('frameCount'),
    grainSize: numberValue('grainSize'),
    signalStrength: numberValue('signalStrength'),
    temporalNoiseDensity: numberValue('temporalNoiseDensity'),
    snowRefreshRate: numberValue('snowRefreshRate'),
    darkColor: stringValue('darkColor'),
    lightColor: stringValue('lightColor'),
  };
};

const generate = () => {
  try {
    const options = readOptions();
    const hasExplicitText = options.text !== undefined;
    if (!hasExplicitText && generatedAnswer) options.text = generatedAnswer;
    options.onRefreshRateChange = (rate) => {
      refreshRate.value = `${rate} Hz`;
      status.value = '运行中 / Running';
    };
    captcha?.destroy();
    captcha = createCaptcha(canvas, options);
    if (!hasExplicitText) generatedAnswer = captcha.answer;

    answer.value = captcha.answer;
    refreshRate.value = '检测中 / Detecting';
    status.value = '同步中 / Syncing';
    errorMessage.hidden = true;
  } catch (error) {
    errorMessage.textContent =
      error instanceof Error ? error.message : String(error);
    errorMessage.hidden = false;
    status.value = '生成失败 / Generation failed';
  }
};

const updateRangeValues = () => {
  const maximumPadding = Math.floor(
    Math.min(Number(widthInput.value), Number(heightInput.value)) / 3,
  );
  paddingInput.max = String(maximumPadding);
  if (Number(paddingInput.value) > maximumPadding) {
    paddingInput.value = String(maximumPadding);
  }

  for (const input of rangeInputs) {
    const output = element<HTMLOutputElement>(`${input.id}-value`);
    output.value =
      input.id === 'scale' && input.value === '0' ? '自动 / Auto' : input.value;
  }
};

const scheduleGeneration = () => {
  updateRangeValues();
  if (pendingGeneration !== undefined) return;
  pendingGeneration = requestAnimationFrame(() => {
    pendingGeneration = undefined;
    generate();
  });
};

form.addEventListener('input', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement) {
    if (['text', 'length', 'charset'].includes(target.name)) {
      generatedAnswer = undefined;
    }
  }
  scheduleGeneration();
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  scheduleGeneration();
});

updateRangeValues();
generate();
