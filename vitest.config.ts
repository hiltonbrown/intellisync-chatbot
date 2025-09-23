import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [
    {
      name: 'mock-katex-css',
      enforce: 'pre',
      resolveId(source) {
        if (source === 'katex/dist/katex.min.css') {
          return source;
        }

        return null;
      },
      load(id) {
        if (id === 'katex/dist/katex.min.css') {
          return 'export default {}';
        }

        return null;
      },
    },
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      '@/ui': path.resolve(__dirname, './src/ui'),
      'katex/dist/katex.min.css': path.resolve(
        __dirname,
        './tests/mocks/styleMock.ts',
      ),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/vitest.setup.ts'],
    css: true,
    include: ['components/**/*.test.{ts,tsx}'],
    exclude: [
      'node_modules',
      'dist',
      '.next',
      'tests/**/*',
      'lib/ai/models.test.ts',
    ],
  },
});
