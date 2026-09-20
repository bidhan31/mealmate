import js from '@eslint/js';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';

// Flat ESLint config (ESLint v10 no longer reads .eslintrc files).
// Mirrors the previous .eslintrc.cjs: eslint:recommended + TS recommended
// with the same rule overrides, Node + Jest globals.
export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: 'module',
      parser: tsParser,
      globals: { ...globals.node, ...globals.jest },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // TypeScript already guarantees these; keeping them on duplicates work
      // and can false-positive on TS-only syntax.
      'no-unused-vars': 'off',
      'no-undef': 'off',
    },
  },
];
