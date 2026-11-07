import { defineConfig } from 'vite';

export default defineConfig({
    root: 'web',
    server: {
        port: 3000,
        open: true,
        proxy: {
            '/api': {
                target: 'http://localhost:5001',
                changeOrigin: true,
                configure: (proxy) => {
                    proxy.on('proxyRes', (proxyRes) => {
                        if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
                            proxyRes.socket.setNoDelay(true);
                        }
                    });
                }
            },
            '/photos': 'http://localhost:5001',
        },
    },
});
