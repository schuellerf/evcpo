import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api/awattar': {
        target: 'https://api.awattar.at',
        changeOrigin: true,
        rewrite: (path) => '/' + path.replace(/^\/api\/awattar\/?/, ''),
      },
    },
  },
});
