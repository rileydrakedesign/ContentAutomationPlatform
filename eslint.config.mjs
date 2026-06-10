import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Separate subprojects with their own tooling (landing/ is its own Next
    // app, mcp/ has its own tsconfig, chrome-extension/ is plain-JS build
    // scripts), agent worktrees, and one-off local scripts.
    "landing/**",
    "mcp/**",
    "chrome-extension/**",
    ".claude/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
