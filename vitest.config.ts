import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // "server-only" melempar error saat diimpor lewat resolusi Node biasa
      // (tanpa export condition "react-server" milik bundler Next.js).
      // Di test, alias ke stub no-op supaya modul yang memakai
      // `import "server-only"` tetap bisa diuji di Vitest.
      "server-only": fileURLToPath(
        new URL("./tests/mocks/server-only.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
