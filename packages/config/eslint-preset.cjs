// Shared ESLint rules for every app and package in the monorepo.
// Apps extend this instead of defining their own lint rules, per AGENTS.md Section 4.
module.exports = {
  root: true,
  extends: ["next/core-web-vitals", "eslint:recommended", "plugin:@typescript-eslint/recommended"],
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn"
  }
};
