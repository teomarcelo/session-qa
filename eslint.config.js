import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'next-app/**',
      '.firebase/**',
      // Stale agent worktree holding a full second copy of the source tree.
      '.claude/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // The two long-standing hook correctness rules. The plugin's newer
      // React-Compiler rules are intentionally left off: they flag hundreds of
      // pre-existing patterns here and would bury real findings.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': 'off',
      // Swallowing storage/JSON errors is a deliberate pattern here (private
      // browsing throws), so an empty catch block is allowed.
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Unused callback args and ignored catch bindings are noise, not bugs.
      // ignoreRestSiblings keeps the `const { drop, ...rest } = obj` omit
      // pattern from being reported.
      'no-unused-vars': [
        'error',
        {
          args: 'none',
          caughtErrors: 'none',
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['test/**/*.mjs', 'scripts/**/*.mjs', '*.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
    },
  },
];
