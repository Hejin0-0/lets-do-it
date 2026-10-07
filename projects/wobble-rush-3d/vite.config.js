import { defineConfig } from 'vite';

// relative URLs: the hub serves the build under /p/wobble-rush-3d/. test.html is a dev-server
// page (npm run dev, then /test.html), so only index.html is built.
export default defineConfig({ base: './' });
