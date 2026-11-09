import { defineConfig } from "vitest/config";

// Testes de banco: precisam de um Postgres (TEST_DATABASE_URL). Rodam com `npm run test:db`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["supabase/tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: true,
  },
});
