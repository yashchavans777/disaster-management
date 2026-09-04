import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        // Use 'classic' SW type in dev to avoid globbing non-existent build assets
        type: 'classic',
        navigateFallback: 'index.html',
      },
      // Only include assets that will definitely exist in the build output.
      // Omitting pwa icon filenames here prevents the "glob pattern matches no files"
      // warning during `vite dev` when those files aren't in public/ yet.
      includeAssets: ['favicon.ico'],
      manifest: {
        name: 'SmartLogistics NER',
        short_name: 'SmartLogistics',
        description:
          'Offline-ready smart logistics dashboard for North Eastern Region disaster response.',
        theme_color: '#2563eb',
        background_color: '#f1f5f9',
        display: 'standalone',
        orientation: 'portrait-primary',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Explicit glob patterns scoped to the Vite output directory.
        // This replaces the implicit default that tries to match png/svg/ico
        // files that may not exist during development, causing the warning.
        globPatterns: ['**/*.{js,css,html}'],
        // Silence "revision missing" warnings for navigation fallback
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/socket\.io/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname === '/api/routes' || url.pathname.startsWith('/api/routes/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-routes-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: ({ url }) =>
              url.pathname === '/api/shipments' || url.pathname.startsWith('/api/shipments/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-shipments-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              networkTimeoutSeconds: 5,
            },
          },
          {
            // Cache map tiles for offline map support (Esri World Street Map + OSM)
            urlPattern: ({ url }) =>
              url.hostname.endsWith('server.arcgisonline.com') ||
              url.hostname.endsWith('tile.openstreetmap.org'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'map-tiles-cache',
              expiration: {
                maxEntries: 1000,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});