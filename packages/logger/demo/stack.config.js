import { defineConfig } from "stack54/config";

export default defineConfig({
  build: { outDir: "build" },
  entry: "./resources/entry.ts",
  views: ["./resources/views/**/*.{entry,page}.svelte"],
});
