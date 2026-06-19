import { defineConfig } from 'vitest/config';

// 모노레포 전체 테스트 설정 — apps/와 packages/ 양쪽 테스트를 포함
export default defineConfig({
    test: {
        globals: true,
        include: [
            'apps/*/src/**/*.{test,spec,prop}.ts',
            'packages/*/src/**/*.{test,spec,prop}.ts',
        ],
    },
});
