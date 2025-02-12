import { defineConfig } from "eslint-define-config";

export default defineConfig({
  env: {
    browser: false,
    node: true,
    es6: true,
  },
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    semi: ["error", "always"],
    quotes: ["error", "double"],
  },
});
