import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'coverage',
      'dist',
      'node_modules',
      'playwright-report',
      'test-results',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    files: ['tests/**/*.ts', '*.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
);
