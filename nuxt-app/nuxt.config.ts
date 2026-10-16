// https://nuxt.com/docs/api/configuration/nuxt-config
import { version } from './package.json'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  css: ['~/assets/css/main.css'],
  // Read from package.json at build time so the running app and the release
  // tag can't drift apart. A compiled binary has no package.json beside it,
  // which is why this is baked in rather than read at runtime.
  runtimeConfig: {
    public: {
      appVersion: version,
      // Party pages link here, since gaq-party does not serve the main app's
      // pages. The party launcher sets NUXT_PUBLIC_MAIN_APP_URL at run time.
      mainAppUrl: 'http://127.0.0.1:3000'
    }
  },
  // Party pages render in the browser only, so no server-side fetch has to
  // carry the front door's headers or the host's session cookie.
  routeRules: {
    '/party/**': { ssr: false }
  },
  nitro: {
    esbuild: {
      options: {
        target: 'es2022'
      }
    }
  },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }
      ]
    }
  }
})
