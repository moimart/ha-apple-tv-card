import { defineConfig } from "vite";

export default defineConfig({
  build: {
    lib: {
      entry: "src/card.ts",
      formats: ["es"],
      fileName: () => "apple-tv-remote-card.js",
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
    minify: "terser",
    target: "es2022",
    sourcemap: false,
    emptyOutDir: false,
  },
});
