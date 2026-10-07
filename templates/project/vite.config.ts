import { defineConfig } from 'vite'

// base './': the hub serves the build from /p/<slug>/ inside an iframe.
export default defineConfig({ base: './' })
