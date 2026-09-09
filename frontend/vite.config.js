/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
    server: { port: 5173 },
    // The suite covers the pure logic that decides whether a physician can
    // submit, so it needs no DOM and stays fast enough to run on every push.
    test: {
        environment: "node",
        include: ["src/**/*.test.ts"],
    },
});
