import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // web-tree-sitter ships a .wasm file we load at runtime. Keep it out of the
  // dependency optimizer's way so it is served as a static asset.
  optimizeDeps: {
    exclude: ['web-tree-sitter'],
  },
  assetsInclude: ['**/*.wasm'],
})