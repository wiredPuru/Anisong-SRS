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
      appVersion: version
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
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Sora:wght@700&family=M+PLUS+Rounded+1c:wght@500;700;800&display=swap'
        }
      ]
    }
  }
})
