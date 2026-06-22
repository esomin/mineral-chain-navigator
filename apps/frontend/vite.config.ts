import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite 설정 - React 플러그인 및 개발 서버 구성
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3000,
        // 백엔드 API 프록시 설정
        proxy: {
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});
