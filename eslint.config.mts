import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores, defineConfig } from "eslint/config";

export default defineConfig(
  globalIgnores([
    "node_modules",
    "esbuild.config.mjs",
    "version-bump.mjs",
    "vitest.config.ts",
    "versions.json",
    "main.js",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
  ]),
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: { allowDefaultProject: ["manifest.json"] },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".json"],
      },
    },
  },
  ...obsidianmd.configs.recommended,
  // tsc already checks names, and no-undef misreads names resolved inside a `declare module` block.
  { files: ["**/*.ts"], rules: { "no-undef": "off" } }
);
