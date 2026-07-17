import { defineConfig } from '@rsbuild/core';

export default defineConfig({
  html: {
    template: './index.html',
    title: 'Afterimage Captcha Playground',
  },
  output: {
    assetPrefix: '/afterimage-captcha/',
    target: 'web',
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
  },
  tools: {
    rspack: {
      watchOptions: {
        ignored: ['**/.playwright-cli/**', '**/output/**', '**/dist/**'],
      },
    },
  },
});
