import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
        manifest: {
          name: 'DAEZKT POS SYSTEM',
          short_name: 'DAEZKT POS',
          description: 'Sistema ERP y Punto de Venta DAEZKT',
          theme_color: '#8ec5fc',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: 'https://zznzarpbntmvymtfapwx.supabase.co/storage/v1/object/public/branding/Logo%20para%20icono%20pwa.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'https://zznzarpbntmvymtfapwx.supabase.co/storage/v1/object/public/branding/Logo%20para%20icono%20pwa.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'https://zznzarpbntmvymtfapwx.supabase.co/storage/v1/object/public/branding/Logo%20para%20icono%20pwa.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
