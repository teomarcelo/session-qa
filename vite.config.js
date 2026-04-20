import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  appType: 'mpa',
  /** Relative asset URLs so `dist/` works from any host path (e.g. GitHub Pages). */
  base: './',
  build: {
    rollupOptions: {
      input: {
        instructor: resolve(__dirname, 'instructor.html'),
        student: resolve(__dirname, 'student.html'),
      },
    },
  },
});
