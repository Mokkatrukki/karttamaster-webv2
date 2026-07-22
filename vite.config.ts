import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // Dev: clean-URL-mappaus (nginx tekee tämän prodissa). /patkat → patkat.html.
  plugins: [
    {
      name: 'clean-urls-dev',
      configureServer(server) {
        server.middlewares.use((req, _res, next) => {
          if (req.url === '/patkat' || req.url === '/patkat/') req.url = '/patkat.html'
          next()
        })
      },
    },
  ],
  server: {
    host: true,
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3001',
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        inventory: resolve(__dirname, 'inventory.html'),
        patkat: resolve(__dirname, 'patkat.html'),
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.ts'],
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/admin.ts'],
    },
  },
})
