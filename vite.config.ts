import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import * as fs from 'fs'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  server: {
    https: {
      key: fs.readFileSync('./keystore/localhost-key.pem'),
      cert: fs.readFileSync('./keystore/localhost-cert.pem'),
    }
  },
})
