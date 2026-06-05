import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        include: ['packages/*/src/**/*.{test,spec,prop}.ts'],
    },
});
