import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        tailwindcss(),
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          workbox: {
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'unsplash-images',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 7 * 24 * 60 * 60 // 7 Days
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /^https:\/\/[a-z]\.basemaps\.cartocdn\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'leaflet-tiles',
                  expiration: {
                    maxEntries: 500,
                    maxAgeSeconds: 30 * 24 * 60 * 60 // 30 Days
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              }
            ]
          },
          manifest: {
            name: 'LoreLens',
            short_name: 'LoreLens',
            description: 'A cross-cultural interpreter for travelers in Beijing.',
            theme_color: '#000000',
            background_color: '#000000',
            display: 'standalone',
            icons: [
              {
                src: '/icon.svg',
                sizes: '192x192 512x512',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              }
            ]
          }
        })
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
