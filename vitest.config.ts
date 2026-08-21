import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    exclude: [
      // Hardhat/Mocha contract tests — run these with `npm run test:contracts`
      'contracts/test/**',
      // Standalone Node assertions — run these with `npm run test:network`
      'tests/networkConfig.test.ts',
      '**/node_modules/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
