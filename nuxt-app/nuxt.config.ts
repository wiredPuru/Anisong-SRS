// https://nuxt.com/docs/api/configuration/nuxt-config
import { version } from './package.json'
import { THEME_BOOT_SCRIPT } from './app/utils/theme'

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
          href: 'https://fonts.googleapis.com/css2?family=Mochiy+Pop+One&family=Zen+Maru+Gothic:wght@400;500;700&display=swap'
        }
      ],
      script: [{ innerHTML: THEME_BOOT_SCRIPT, tagPosition: 'head' }]
    }
  }
})
