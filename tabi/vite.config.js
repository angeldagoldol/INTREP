import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { brochureOutlines } from './scripts/build/brochure-outline.mjs';
import { photoDownloadStatus } from './scripts/build/photo-status.mjs';

/**
 * Photo manifests (src/data/photos/manifest/*.json) list Commons candidates for
 * curation. The app needs what each photo shows (alt, caption, place, focus,
 * use) and, for live photos (src/data/photos/live.js), the Commons titles to
 * try and the search words (`query`). The curated `file`, when set, is folded
 * in front of `candidates` so it is tried first.
 */
function photoManifests() {
  const manifest = /[\\/]src[\\/]data[\\/]photos[\\/]manifest[\\/][^\\/]+\.json$/;
  const slim = (photo) => {
    if (!photo || typeof photo !== 'object') return photo;
    const { file, candidates, ...keep } = photo;
    const titles = [file, ...(Array.isArray(candidates) ? candidates : [])].filter((t) => typeof t === 'string' && t.trim());
    return titles.length ? { ...keep, candidates: [...new Set(titles)] } : keep;
  };
  return {
    name: 'tabi-photo-manifests',
    enforce: 'pre',
    transform(code, id) {
      if (!manifest.test(id.split('?')[0])) return null;
      try {
        const json = JSON.parse(code);
        const photos = Array.isArray(json?.photos) ? json.photos.map(slim) : [];
        return { code: JSON.stringify({ ...json, photos }), map: null };
      } catch {
        return null; // let Vite report the broken JSON
      }
    },
  };
}

// `base: './'` keeps every asset URL relative, so the built `dist/` folder
// works from any host or sub-path (Vercel, Netlify, GitHub Pages, a USB stick).
export default defineConfig({
  base: './',
  // photoDownloadStatus (dev only): what `npm run dev`'s background photo download is doing, for the photo notice.
  plugins: [react(), photoManifests(), brochureOutlines(), photoDownloadStatus()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // Fold tiny shared chunks (a single lucide icon, Chip, Switch…) into
        // their importers instead of shipping a dozen sub-kilobyte requests.
        experimentalMinChunkSize: 8_000,
        // Shared chunks are otherwise named after whichever module Rollup
        // picks first; give the cover-art and page-renderer chunks recognisable names.
        chunkFileNames(chunk) {
          if (chunk.isDynamicEntry) return 'assets/[name]-[hash].js';
          const has = (file) => chunk.moduleIds.some((id) => id.replace(/\\/g, '/').endsWith(`/src/components/brochure/${file}`));
          if (has('CoverArt.jsx')) return 'assets/cover-art-[hash].js';
          if (has('BrochurePage.jsx')) return 'assets/BrochurePage-[hash].js';
          return 'assets/[name]-[hash].js';
        },
        // Two long-lived vendor chunks that change far less often than app
        // code. A function (not the object form) so sub-paths such as
        // react-dom/client and framer-motion's motion-dom land here too.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom|cookie|set-cookie-parser)[\\/]/.test(id)) {
            return 'react';
          }
          if (/[\\/]node_modules[\\/](framer-motion|motion-dom|motion-utils)[\\/]/.test(id)) return 'motion';
          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: false,
  },
});
