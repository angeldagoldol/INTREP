import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

const compilerRules = Object.fromEntries(
  Object.keys(reactHooks.configs['recommended-latest'].rules)
    .filter((rule) => !['react-hooks/rules-of-hooks', 'react-hooks/exhaustive-deps'].includes(rule))
    .map((rule) => [rule, 'warn']),
);

export default [
  { ignores: ['dist', 'node_modules', 'coverage', '.cache'] },
  {
    files: ['**/*.{js,jsx,mjs}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: { react, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    settings: { react: { version: 'detect' } },
    rules: {
      ...js.configs.recommended.rules,
      ...compilerRules,
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-uses-vars': 'error',
      'react/jsx-key': 'error',
      'react/jsx-no-target-blank': 'error',
      'react/no-unknown-property': ['error', { ignore: ['fetchpriority'] }],
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Context modules export a provider plus its hook; that is fine.
    files: ['src/context/**', 'src/components/ui/Icon.jsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['**/*.test.{js,jsx,mjs}', 'src/test/**'],
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.vitest } },
  },
];
