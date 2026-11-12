import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const DEV_API_PROXY_PREFIX = '/__splitnest_api';

function isLocalHostUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawApiBaseUrl = (env.VITE_API_BASE_URL || 'https://localhost:8081').trim().replace(/\/+$/, '');
  const useDevProxy =
    command === 'serve' &&
    env.VITE_DISABLE_DEV_PROXY !== 'true' &&
    /^https?:\/\//i.test(rawApiBaseUrl) &&
    !isLocalHostUrl(rawApiBaseUrl);

  const proxyConfig: Record<string, string | ProxyOptions> | undefined = useDevProxy
    ? {
        [DEV_API_PROXY_PREFIX]: {
          target: rawApiBaseUrl,
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/__splitnest_api/, '') || '/',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.removeHeader('origin');
              proxyReq.removeHeader('referer');
            });
            proxy.on('proxyRes', (proxyRes) => {
              delete proxyRes.headers['strict-transport-security'];
            });
          },
        },
      }
    : undefined;

  return {
  ...(proxyConfig ? { server: { proxy: proxyConfig } } : {}),
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/')) {
              return 'react-vendor';
            }
            if (id.includes('@tanstack/react-query')) {
              return 'query-vendor';
            }
          }
          return undefined;
        },
      },
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png'],
      manifest: {
        name: 'SplitNest',
        short_name: 'SplitNest',
        description: 'Track and split group expenses seamlessly',
        theme_color: '#065f46',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
    }),
  ],
  };
})
