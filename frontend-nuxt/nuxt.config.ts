import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  ssr: true,
  devtools: { enabled: false },

  modules: ['@pinia/nuxt', 'motion-v/nuxt'],

  // app/components/ui/*.vue would otherwise auto-register with a `Ui` prefix
  // (<UiCard> instead of <Card>) since Nuxt prefixes nested component dirs by
  // default. pathPrefix: false keeps the shadcn-style bare names.
  components: [
    { path: '~/components/ui', pathPrefix: false },
    '~/components',
  ],

  css: ['~/assets/css/main.css'],

  vite: {
    plugins: [tailwindcss()],
  },

  // Note: 5175 was the originally planned port, but it's occupied by a stray
  // duplicate frontend-admin dev server instance on this machine (not started
  // by this build) — using 5176 instead to avoid the conflict.
  devServer: {
    port: 5176,
  },

  // Equivalent of the old Vite proxy: '/api' -> localhost:3000, no rewrite.
  // `nitro.devProxy` does not exist in this Nitro version (2.13.4) — checked
  // its type defs directly. The real mechanism is a routeRules proxy rule.
  routeRules: {
    '/api/**': { proxy: 'http://localhost:3000/api/**' },
  },

  typescript: {
    strict: true,
    typeCheck: true,
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Mediport — Book an Appointment',
    },
  },
})
