import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  html: {
    template: './index.html',
    title: 'Afterimage Captcha Playground',
  },
  output: {
    target: 'web',
  },
});
