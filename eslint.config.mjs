// ESLint configuration for the whole monorepo (replaces tslint + tslint-config-haiku).
// The style rules describe the existing code style; `yarn lint` only reports, `yarn lint:fix` applies fixes.
import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/lib/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.nyc_output/**',
      '**/vendor/**',
      '**/*.min.js',
      // Generated or third-party project content used as fixtures and demos.
      '**/test/projects/**',
      '**/test/fixtures/**',
      '**/test/goldens/**',
      'packages/@haiku/core/demo/**',
      'packages/haiku-creator/src/react/bytecode-fixtures/**',
      'packages/*/public/**',
      'packages/haiku-creator/template-design-files/**',
      // Vendored copies of third-party code.
      'packages/haiku-fs-extra/**',
      'packages/haiku-vendor-legacy/**',
      'packages/haiku-glass/src/react/modes/haiku.js',
      'packages/haiku-timeline/src/components/modes/haiku.js',
      'packages/haiku-serialization/src/svg/plugins/haikuCollapseGroups.js',
      // Generated lists and test inputs whose formatting is part of the data.
      'packages/@haiku/core/src/reflection/ReservedWords.ts',
      'packages/@haiku/core/test/unit/reflection.functionToRFO.impl.js',
      'packages/haiku-plumbing/test/git/git1.js',
    ],
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    plugins: {'@stylistic': stylistic},
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {ecmaFeatures: {jsx: true}},
      globals: {...globals.browser, ...globals.node},
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'warn',
    },
    rules: {
      // Correctness
      'curly': 'error',
      'eqeqeq': ['error', 'always', {null: 'ignore'}],
      'no-debugger': 'error',
      'no-eval': 'error',
      'no-var': 'error',
      'prefer-const': ['error', {destructuring: 'all'}],
      'radix': 'error',
      'no-throw-literal': 'error',
      '@typescript-eslint/no-unused-vars': ['error', {
        args: 'none',
        caughtErrors: 'none',
        ignoreRestSiblings: true,
        varsIgnorePattern: '^_',
        destructuredArrayIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-unused-expressions': ['error', {allowShortCircuit: true, allowTernary: true}],

      // Rules tslint never enforced and the legacy code base breaks widely; candidates for gradual enabling.
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-wrapper-object-types': 'off',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-this-alias': 'off',
      'no-prototype-builtins': 'off',
      'no-case-declarations': 'off',
      'no-useless-escape': 'off',
      'no-useless-assignment': 'off',
      'prefer-spread': 'off',
      'prefer-rest-params': 'off',

      // Style (matches the code base)
      '@stylistic/indent': ['error', 2, {SwitchCase: 1, flatTernaryExpressions: true}],
      '@stylistic/quotes': ['error', 'single', {avoidEscape: true, allowTemplateLiterals: 'always'}],
      '@stylistic/jsx-quotes': ['error', 'prefer-double'],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/object-curly-spacing': ['error', 'never'],
      '@stylistic/array-bracket-spacing': ['error', 'never'],
      '@stylistic/space-in-parens': ['error', 'never'],
      '@stylistic/space-before-function-paren': ['error', {anonymous: 'always', named: 'always', asyncArrow: 'always'}],
      '@stylistic/keyword-spacing': 'error',
      '@stylistic/space-before-blocks': 'error',
      '@stylistic/space-infix-ops': ['error', {ignoreTypes: true}],
      '@stylistic/comma-spacing': 'error',
      '@stylistic/arrow-parens': ['error', 'always'],
      '@stylistic/brace-style': ['error', '1tbs', {allowSingleLine: true}],
      '@stylistic/eol-last': 'error',
      '@stylistic/no-trailing-spaces': 'error',
      '@stylistic/no-multiple-empty-lines': ['error', {max: 1, maxEOF: 0}],
      '@stylistic/spaced-comment': ['error', 'always', {markers: ['/'], exceptions: ['-', '=', '*']}],
    },
  },
  {
    // tslint limited line length in TypeScript only.
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@stylistic/max-len': ['error', {code: 120, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true}],
    },
  },
);
