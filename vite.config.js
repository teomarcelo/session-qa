import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/** reCAPTCHA site keys are a fixed 40-char `6L…` token. */
const SITE_KEY_PATTERN = /6L[A-Za-z0-9_-]{38}/;

/**
 * Fails the production build when no App Check site key reaches the output.
 *
 * Vite inlines `import.meta.env` at build time, so an unresolved key produces a
 * bundle that runs fine and quietly skips App Check. That shipped undetected once
 * already; asserting against the emitted chunks catches it however it recurs.
 */
function assertAppCheckKeyBundled() {
  return {
    name: 'assert-appcheck-key-bundled',
    apply: 'build',
    generateBundle(_options, bundle) {
      const bundled = Object.values(bundle).some(
        (output) => output.type === 'chunk' && SITE_KEY_PATTERN.test(output.code),
      );
      if (!bundled) {
        this.error(
          'App Check site key is missing from the production bundle. Check ' +
            'APPCHECK_SITE_KEY in src/config/firebase.js and any VITE_APPCHECK_SITE_KEY ' +
            'override — building with it empty ships App Check inactive.',
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), assertAppCheckKeyBundled()],
  appType: 'mpa',
  /** Relative asset URLs so `dist/` works from any host path (e.g. GitHub Pages). */
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        instructor: resolve(__dirname, 'instructor.html'),
        student: resolve(__dirname, 'student.html'),
      },
    },
  },
});
