import path from 'path';
import { defineConfig } from 'vite';
import { devvit } from '@devvit/start/vite';

export default defineConfig({
  plugins: [devvit()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
