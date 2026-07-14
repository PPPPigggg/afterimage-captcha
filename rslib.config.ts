import { defineConfig } from '@rslib/core';

export default defineConfig({
  lib: [
    {
      bundle: true,
      syntax: 'es2022',
      dts: true,
    },
  ],
  output: {
    target: 'web',
  },
});
