import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/** Other code is reached only through its public entry point. */
const PUBLIC_API = [
  {
    regex: "^@/modules/[^/]+/.+",
    message: "Import other modules only through their public API: '@/modules/<name>'.",
  },
  { regex: "^@/core/.+", message: "Import the kernel only through its public API: '@/core'." },
  { regex: "^@/ui/.+", message: "Import the UI kit only through its public API: '@/ui'." },
];

/** A layer that must not import the given higher layers (CLAUDE.md, Layering). */
function layer(files, forbidden, why) {
  return {
    files,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...PUBLIC_API,
            ...forbidden.map((target) => ({ regex: `^@/${target}(/|$)`, message: why })),
          ],
        },
      ],
    },
  };
}

export default tseslint.config(
  { ignores: ["dist", "src-tauri"] },
  {
    files: ["src/**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      // Module boundary: other modules and the kernel are only reachable through their index.ts.
      "no-restricted-imports": ["error", { patterns: PUBLIC_API }],
    },
  },
  layer(["src/core/**"], ["modules", "ui", "app"], "The kernel knows no module, UI or shell."),
  layer(
    ["src/ui/**"],
    ["core", "modules", "app"],
    "The UI kit is stateless: React and its own files only.",
  ),
  layer(["src/modules/**"], ["app"], "Modules never import the shell; contribute through points."),
);
