import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' → rutas relativas, para que el build funcione igual en
// Cloudflare Pages, Netlify o un subdirectorio de GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
});
