import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3003,
    host: '0.0.0.0',
    proxy: {
      '/api/awattar': {
        target: 'https://api.awattar.at',
        changeOrigin: true,
        rewrite: (path) => '/' + path.replace(/^\/api\/awattar\/?/, ''),
      },
    },
  },
});
