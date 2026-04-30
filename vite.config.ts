import { defineConfig } from 'vite'

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.ts'],
    reporters: ['verbose'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts'],
    },
  },
})
