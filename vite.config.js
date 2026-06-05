import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
